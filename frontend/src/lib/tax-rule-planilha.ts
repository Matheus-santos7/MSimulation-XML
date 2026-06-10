import * as XLSX from "xlsx";
import type { TaxRuleImportRow } from "@/lib/fiscal-api";

export type TaxRulePlanilhaParseResult = {
  rows: TaxRuleImportRow[];
  errors: { line: number; message: string }[];
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

function normalizeValue(value: unknown): unknown {
  const n = toNumberLike(value);
  return n ?? (typeof value === "string" ? value.trim() : value);
}

function detectTransactionType(customerLabel: string): "sale" | "inbound" {
  const t = customerLabel.toLowerCase();
  if (t.includes("envio de estoque") || t.includes("transfer") || t.includes("remessa")) return "inbound";
  return "sale";
}

function detectCustomerType(customerLabel: string): "taxpayer" | "non_taxpayer" {
  const t = customerLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (t.includes("nao contribuinte") || t.includes("consumidor final")) return "non_taxpayer";
  return "taxpayer";
}

function destinationLabel(transactionType: "sale" | "inbound", customerType: "taxpayer" | "non_taxpayer"): string {
  if (transactionType === "inbound") return "Envio de estoque (Transferência ou Remessa)";
  return customerType === "taxpayer" ? "Contribuinte" : "Não contribuinte";
}

const TAX_RULE_SHEET_ALIASES = ["regras tributárias", "regras tributarias"];

type RuleIdentityState = {
  ruleId: string;
  ruleName: string;
  origin: string;
};

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

export function parseTaxRuleXlsx(buffer: ArrayBuffer): TaxRulePlanilhaParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = findTaxRuleSheet(wb);
  if (!sheet) return { rows: [], errors: [{ line: 1, message: "Aba 'Regras tributárias' não encontrada" }] };

  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  if (matrix.length < 4) return { rows: [], errors: [{ line: 1, message: "Planilha sem linhas de dados" }] };

  const keyRow = matrix[1]!.map((v) => String(v ?? "").trim());
  const errors: { line: number; message: string }[] = [];
  const rows: TaxRuleImportRow[] = [];

  let identity: RuleIdentityState = { ruleId: "", ruleName: "", origin: "" };

  for (let i = 3; i < matrix.length; i++) {
    const line = i + 1;
    const row = matrix[i] ?? [];
    if (row.every((v) => String(v ?? "").trim() === "")) continue;

    const byKey: Record<string, unknown> = {};
    for (let c = 0; c < keyRow.length; c++) {
      const key = keyRow[c];
      if (!key) continue;
      byKey[key] = normalizeValue(row[c]);
    }

    identity = resolveRuleIdentity(byKey, identity);
    const { ruleId, ruleName: nome, origin } = identity;
    const customerLabel = String(byKey.TRANSACTION_TYPE ?? "").trim();

    if (!ruleId || !nome || !origin || !customerLabel) {
      errors.push({ line, message: "Linha sem RULE_ID/RULE_NAME/ORIGIN/TRANSACTION_TYPE" });
      continue;
    }

    const uf = origin.slice(0, 2).toUpperCase();
    const transactionType = detectTransactionType(customerLabel);
    const customerType = detectCustomerType(customerLabel);
    const tipo = "MELI_RULE";
    // CFOP é resolvido na emissão (remessa 5949/6949, retorno 1949/2949) — não gravar na planilha.
    const cfop = "";
    const aliquota = String(byKey[`ICMS_${uf}_PICMS_INTERNAL`] ?? byKey.IPI_ALIQUOTA ?? "");

    const payload: Record<string, unknown> = {
      operation: {
        transactionType,
        customerType,
      },
      taxes: {
        ipi: {
          st: byKey.IPI_ST,
          aliquota: byKey.IPI_ALIQUOTA,
          codEnq:
            byKey.IPI_COD_ENQ != null && String(byKey.IPI_COD_ENQ).trim() !== ""
              ? String(byKey.IPI_COD_ENQ).trim()
              : undefined,
        },
        pis: { st: byKey.PIS_ST, aliquota: byKey.PIS_ALIQUOTA },
        cofins: { st: byKey.COFINS_ST, aliquota: byKey.COFINS_ALIQUOTA },
        ibsCbs: {
          st: byKey.IBS_CBS_ST,
          cClassTrib: byKey.IBS_CBS_CCLASSTRIB,
          reducao: byKey.IBS_CBS_REDUCAO,
        },
      },
      icmsByUf: Object.fromEntries(
        Object.entries(byKey)
          .filter(([k]) => k.startsWith("ICMS_"))
          .map(([k, v]) => [k, v]),
      ),
    };

    rows.push({
      ruleId: `${ruleId}-${uf}-${customerType}-${transactionType}`,
      nome: `${nome} (${destinationLabel(transactionType, customerType)})`,
      tipo,
      uf,
      cfop,
      aliquota,
      transactionType,
      customerType,
      origin,
      payload,
    });
  }

  return { rows, errors };
}
