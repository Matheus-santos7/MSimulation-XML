import * as XLSX from "xlsx";
import type { TaxRuleSpreadsheetRawRow } from "../../modules/tax/domain/entities/tax-rule-spreadsheet-raw-row.entity.js";

export type TaxRuleSpreadsheetParseResult = {
  rawRows: TaxRuleSpreadsheetRawRow[];
  errors: { line: number; message: string }[];
};

const TAX_RULE_SHEET_ALIASES = ["regras tributárias", "regras tributarias"];

type RuleIdentityState = {
  ruleId: string;
  ruleName: string;
  origin: string;
};

function toNumberLike(value: unknown): unknown {
  if (value == null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  if (text === "Não aplicável" || text === "Calculada automaticamente") return undefined;
  const normalized = text.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : text;
}

function normalizeCellValue(value: unknown): unknown {
  const n = toNumberLike(value);
  return n ?? (typeof value === "string" ? value.trim() : value);
}

function isNumericRuleId(value: string): boolean {
  return /^\d+$/.test(value);
}

/** Planilhas ML mesclam células: RULE_ID/RULE_NAME/ORIGIN repetem só na 1ª linha do grupo. */
function resolveRuleIdentity(byKey: Record<string, unknown>, state: RuleIdentityState): RuleIdentityState {
  const rawRuleId = String(byKey.RULE_ID ?? "").trim();
  const rawRuleName = String(byKey.RULE_NAME ?? "").trim();
  const rawOrigin = String(byKey.ORIGIN ?? "").trim();
  const next = { ...state };

  if (rawOrigin) next.origin = rawOrigin;

  if (rawRuleName) {
    next.ruleName = rawRuleName;
    if (isNumericRuleId(rawRuleName)) next.ruleId = rawRuleName;
    else if (rawRuleId) next.ruleId = rawRuleId;
  } else if (rawRuleId) {
    next.ruleId = rawRuleId;
  }

  return next;
}

function findTaxRuleSheet(wb: XLSX.WorkBook): XLSX.WorkSheet | undefined {
  const byName = new Map(wb.SheetNames.map((name) => [name.trim().toLowerCase(), wb.Sheets[name]!]));
  for (const alias of TAX_RULE_SHEET_ALIASES) {
    const sheet = byName.get(alias);
    if (sheet) return sheet;
  }
  return undefined;
}

/**
 * Lê a aba "Regras tributárias" e extrai linhas brutas (sem montar payload fiscal).
 */
export function parseTaxRuleSpreadsheet(buffer: Buffer | ArrayBuffer): TaxRuleSpreadsheetParseResult {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = findTaxRuleSheet(wb);
  if (!sheet) return { rawRows: [], errors: [{ line: 1, message: "Aba 'Regras tributárias' não encontrada" }] };

  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  if (matrix.length < 4) return { rawRows: [], errors: [{ line: 1, message: "Planilha sem linhas de dados" }] };

  const keyRow = matrix[1]!.map((v) => String(v ?? "").trim());
  if (!keyRow.some((k) => k.length > 0)) {
    return { rawRows: [], errors: [{ line: 2, message: "Planilha sem cabeçalho de colunas (linha 2)" }] };
  }

  const errors: { line: number; message: string }[] = [];
  const rawRows: TaxRuleSpreadsheetRawRow[] = [];

  let identity: RuleIdentityState = { ruleId: "", ruleName: "", origin: "" };

  for (let i = 3; i < matrix.length; i++) {
    const line = i + 1;
    const row = matrix[i] ?? [];
    if (row.every((v) => String(v ?? "").trim() === "")) continue;

    const cells: Record<string, unknown> = {};
    for (let c = 0; c < keyRow.length; c++) {
      const key = keyRow[c];
      if (!key) continue;
      cells[key] = normalizeCellValue(row[c]);
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
