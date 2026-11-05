import * as XLSX from "xlsx";
import type { TaxRuleSpreadsheetRawRow } from "../types/tax-rule-spreadsheet-raw-row.types.js";

export type TaxRuleSpreadsheetParseResult = {
  rawRows: TaxRuleSpreadsheetRawRow[];
  errors: { line: number; message: string }[];
};

const TAX_RULE_SHEET_ALIASES = ["regras tributárias", "regras tributarias"];

type RuleIdentityState = {
  ruleId: string;
  ruleName: string;
  origin: string;
  /** RULE_ID bruto da linha de cabeçalho do grupo atual. */
  lastRawRuleId: string;
  /** Identificador estável do grupo (persistência), independente do rótulo de continuação. */
  groupRuleId: string;
};

/**
 * Limite de linhas de DADOS aceitas na aba. Existe porque o XLSX.read materializa a aba inteira
 * em memória antes de qualquer validação: sem teto, um arquivo de 15 MB com milhões de linhas
 * vazias/repetidas consome a memória do processo. Para aceitar planilhas maiores, suba o valor
 * e confira o tempo de gravação em lote.
 */
export const MAX_TAX_RULE_SHEET_ROWS = 5000;

/**
 * Teto de colunas da aba. O `sheetRows` só corta LINHAS: uma célula em XFD (a última coluna do
 * Excel, 16384) faz o `sheet_to_json` criar milhões de células vazias (`defval: ""`), travando o
 * servidor por minutos e ocupando GBs (medido: arquivo de 8,6 KB, ~110 s, 1,4 GB). A planilha ML
 * real tem ~400 colunas (ICMS por UF); 1000 dá folga. Se o layout crescer, suba este valor.
 */
export const MAX_TAX_RULE_SHEET_COLUMNS = 1000;

/** Linhas fixas antes dos dados: faixa mesclada, chaves (linha 2) e rótulos (linha 3). */
const HEADER_ROWS = 3;

/**
 * Colunas que representam percentuais/valores e por isso viram número.
 *
 * Todas as outras (CST, ST, cClassTrib, COD_ENQ, COD_BENEF, RULE_ID...) são CÓDIGOS: o zero à
 * esquerda é significativo ("000001" != 1), então ficam sempre como texto.
 * Se o marketplace acrescentar uma coluna de valor/alíquota nova, inclua-a aqui:
 * - colunas fora do ICMS: sufixo em NUMERIC_COLUMN_SUFFIXES;
 * - colunas por UF (ICMS_<UF>_<campo>): acrescente o <campo> em NUMERIC_ICMS_FIELDS.
 */
const NUMERIC_COLUMN_SUFFIXES = ["_ALIQUOTA", "_REDUCAO"];
const NUMERIC_ICMS_FIELDS = new Set([
  "PDIF",
  "PICMS_INTERNAL",
  "PICMS_INTERSTATE",
  "REDUCTION_CALC_BASE",
  "REDUCTION_CALC_BASE_ST",
  "REDUCTION_CALC_DIFAL",
  "PICMS_FCP",
  "PICMS_EFET",
  "PREDB_CEFET",
  "MVA",
  "PICMSST_RET",
  "PFCPST_RET",
  "PCOD_BENEF_PRES",
  "RED_ALIQ_IBS",
]);

function isNumericColumn(key: string): boolean {
  if (NUMERIC_COLUMN_SUFFIXES.some((suffix) => key.endsWith(suffix))) return true;
  const icmsField = /^ICMS_[A-Z]{2}_(.+)$/.exec(key)?.[1];
  return icmsField !== undefined && NUMERIC_ICMS_FIELDS.has(icmsField);
}

/** Milhar pt-BR: 1 a 3 dígitos (sem zero à esquerda) seguidos de grupos de exatamente 3. */
const THOUSANDS_PATTERN = /^[1-9]\d{0,2}(\.\d{3})+$/;

/**
 * Converte texto de célula numérica. Com vírgula, o ponto é milhar ("1.234,56" -> 1234.56).
 * Só com ponto, "1.250" é milhar pt-BR (1250) e qualquer outro formato ("12.5", "0.00") é
 * decimal. Valores não numéricos ("Não aplicável") voltam como texto aparado.
 */
function parseNumericText(text: string): number | string {
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : THOUSANDS_PATTERN.test(text)
      ? text.replace(/\./g, "")
      : text;
  const n = Number(normalized);
  return text !== "" && Number.isFinite(n) ? n : text;
}

function normalizeCellValue(key: string, value: unknown): unknown {
  if (value == null) return value;
  const text = typeof value === "string" ? value.trim() : value;
  if (typeof text !== "string" || !isNumericColumn(key)) return text;

  return parseNumericText(text);
}

function isNumericRuleId(value: string): boolean {
  return /^\d+$/.test(value);
}

/**
 * Nome no formato "<código> - <sufixo>", como "39259090 - IMPORTADO".
 *
 * Na planilha ML só o 1º grupo traz RULE_ID; os demais vêm com RULE_ID vazio e este nome na 1ª
 * linha do grupo (as linhas de continuação deixam o nome em branco). Sem tratar esse padrão como
 * início de grupo, os ~60 grupos "- IMPORTADO" caíam no grupo anterior, geravam a mesma chave e só
 * o último sobrevivia. O " - " (com espaços) é obrigatório de propósito: rótulos de continuação
 * como "40021110 (consumo)" continuam sendo ignorados. Se o marketplace mudar o separador,
 * ajuste esta regex e o spec "abre grupo novo quando RULE_ID vem vazio…".
 */
function isCodeWithSuffixName(value: string): boolean {
  return /^\d+\s+-\s+\S/.test(value);
}

/**
 * Escolhe identificador persistível do grupo sem impor formato ao nome exibido.
 *
 * - ML novo: RULE_ID e RULE_NAME distintos, nome não puramente numérico → RULE_ID.
 * - Demais casos: RULE_NAME, senão RULE_ID (aceita numérico, texto ou misto).
 */
function resolveStableRuleId(rawRuleId: string, rawRuleName: string): string {
  if (rawRuleId && rawRuleName && rawRuleName !== rawRuleId && !isNumericRuleId(rawRuleName)) {
    return rawRuleId;
  }
  return rawRuleName || rawRuleId;
}

/**
 * Detecta início de novo grupo na planilha mesclada do ML.
 */
function isNewRuleGroup(rawRuleId: string, rawRuleName: string, state: RuleIdentityState): boolean {
  if (!state.groupRuleId) return Boolean(rawRuleId || rawRuleName);
  if (rawRuleId && rawRuleId !== state.lastRawRuleId) return true;
  if (
    !rawRuleId &&
    rawRuleName &&
    (isNumericRuleId(rawRuleName) || isCodeWithSuffixName(rawRuleName)) &&
    rawRuleName !== state.groupRuleId
  ) {
    return true;
  }
  return false;
}

/**
 * Planilhas ML mesclam células: RULE_ID/RULE_NAME/ORIGIN repetem só na 1ª linha do grupo.
 *
 * RULE_NAME aceita qualquer formato (texto, numérico, misto). O nome exibido vem da 1ª
 * linha do grupo; linhas de continuação podem trazer rótulos mais longos — ignorados.
 *
 * Novo grupo: RULE_ID muda, ou (legado) RULE_ID vazio com RULE_NAME numérico novo.
 * Linhas de continuação legado podem trazer ORIGIN incorreta — herdada do cabeçalho.
 */
function resolveRuleIdentity(
  byKey: Record<string, unknown>,
  state: RuleIdentityState,
): RuleIdentityState {
  const rawRuleId = String(byKey.RULE_ID ?? "").trim();
  const rawRuleName = String(byKey.RULE_NAME ?? "").trim();
  const rawOrigin = String(byKey.ORIGIN ?? "").trim();
  const next = { ...state };

  if (!isNewRuleGroup(rawRuleId, rawRuleName, state)) {
    return next;
  }

  const stableRuleId = resolveStableRuleId(rawRuleId, rawRuleName);
  next.groupRuleId = stableRuleId;
  next.ruleId = stableRuleId;
  next.ruleName = rawRuleName || rawRuleId;
  next.lastRawRuleId = rawRuleId;
  if (rawOrigin) next.origin = rawOrigin;

  return next;
}

function findTaxRuleSheet(wb: XLSX.WorkBook): XLSX.WorkSheet | undefined {
  const byName = new Map(
    wb.SheetNames.map((name) => [name.trim().toLowerCase(), wb.Sheets[name]!]),
  );
  for (const alias of TAX_RULE_SHEET_ALIASES) {
    const sheet = byName.get(alias);
    if (sheet) return sheet;
  }
  return undefined;
}

/**
 * Lê a aba "Regras tributárias" e extrai linhas brutas (sem montar payload fiscal).
 */
export function parseTaxRuleSpreadsheet(
  buffer: Buffer | ArrayBuffer,
): TaxRuleSpreadsheetParseResult {
  // +1 linha além do limite: permite distinguir "exatamente no limite" de "excede".
  const wb = XLSX.read(buffer, {
    type: "buffer",
    sheetRows: MAX_TAX_RULE_SHEET_ROWS + HEADER_ROWS + 1,
  });
  const sheet = findTaxRuleSheet(wb);
  if (!sheet)
    return {
      rawRows: [],
      errors: [{ line: 1, message: "Aba 'Regras tributárias' não encontrada" }],
    };

  // Confere a faixa declarada ANTES de materializar a matriz (ver MAX_TAX_RULE_SHEET_COLUMNS).
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  if (range.e.c - range.s.c + 1 > MAX_TAX_RULE_SHEET_COLUMNS) {
    return {
      rawRows: [],
      errors: [{ line: 1, message: `Planilha excede ${MAX_TAX_RULE_SHEET_COLUMNS} colunas` }],
    };
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  if (matrix.length > MAX_TAX_RULE_SHEET_ROWS + HEADER_ROWS) {
    return {
      rawRows: [],
      errors: [{ line: 1, message: `Planilha excede ${MAX_TAX_RULE_SHEET_ROWS} linhas` }],
    };
  }
  if (matrix.length < 4)
    return { rawRows: [], errors: [{ line: 1, message: "Planilha sem linhas de dados" }] };

  const keyRow = matrix[1]!.map((v) => String(v ?? "").trim());
  if (!keyRow.some((k) => k.length > 0)) {
    return {
      rawRows: [],
      errors: [{ line: 2, message: "Planilha sem cabeçalho de colunas (linha 2)" }],
    };
  }

  const errors: { line: number; message: string }[] = [];
  const rawRows: TaxRuleSpreadsheetRawRow[] = [];

  let identity: RuleIdentityState = {
    ruleId: "",
    ruleName: "",
    origin: "",
    lastRawRuleId: "",
    groupRuleId: "",
  };

  for (let i = 3; i < matrix.length; i++) {
    const line = i + 1;
    const row = matrix[i] ?? [];
    if (row.every((v) => String(v ?? "").trim() === "")) continue;

    const cells: Record<string, unknown> = {};
    for (let c = 0; c < keyRow.length; c++) {
      const key = keyRow[c];
      if (!key) continue;
      cells[key] = normalizeCellValue(key, row[c]);
    }

    identity = resolveRuleIdentity(cells, identity);
    const { ruleId, ruleName, origin } = identity;
    const transactionTypeLabel = String(cells.TRANSACTION_TYPE ?? "").trim();

    if (!ruleId || !ruleName || !origin || !transactionTypeLabel) {
      errors.push({ line, message: "Linha sem RULE_ID/RULE_NAME/ORIGIN/TRANSACTION_TYPE" });
      continue;
    }

    rawRows.push({
      line,
      cells,
      ruleId,
      ruleName,
      origin,
      transactionTypeLabel,
    });
  }

  return { rawRows, errors };
}
