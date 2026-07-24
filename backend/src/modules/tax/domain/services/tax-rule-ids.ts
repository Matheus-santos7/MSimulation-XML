export type CustomerType = "taxpayer" | "non_taxpayer";
export type TransactionType =
  | "sale"
  | "inbound"
  | "symbolic_inbound_return"
  | "inbound_return";

/** Sufixo de operação no ruleId — aliases longos antes de `inbound`. */
const TX = "symbolic_inbound_return|inbound_return|sale|inbound";
const TAX_RULE_ROW_SUFFIX = new RegExp(`-(taxpayer|non_taxpayer)-(${TX})$`, "i");
const TAX_RULE_ROW_WITH_ORIGIN = new RegExp(
  `^(.+)-([A-Z]{2})-(taxpayer|non_taxpayer)-(${TX})$`,
  "i",
);
const TAX_RULE_ROW_LEGACY = new RegExp(`^(.+)-(taxpayer|non_taxpayer)-(${TX})$`, "i");

/**
 * Ordem de lookup no banco: tipo pedido primeiro; aliases para planilha XLSX legado (`inbound`).
 * - `symbolic_inbound_return` → retorno simbólico SALE
 * - `inbound_return` → retorno físico / NEGATIVE difference
 */
export function taxRuleLookupTransactionTypes(
  transactionType: TransactionType,
): TransactionType[] {
  if (transactionType === "symbolic_inbound_return") {
    return ["symbolic_inbound_return", "inbound"];
  }
  if (transactionType === "inbound_return") {
    return ["inbound_return", "inbound"];
  }
  return [transactionType];
}

/** RULE_ID da planilha (sem sufixo origem/contribuinte/operação). */
export function taxRuleBaseIdFromRuleId(ruleId: string): string {
  const withOrigin = ruleId.match(TAX_RULE_ROW_WITH_ORIGIN);
  if (withOrigin) return withOrigin[1]!;
  const legacy = ruleId.match(TAX_RULE_ROW_LEGACY);
  if (legacy) return legacy[1]!;
  return ruleId.replace(TAX_RULE_ROW_SUFFIX, "");
}

export function buildTaxRuleRowId(
  baseId: string,
  customerType: CustomerType,
  transactionType: TransactionType,
  origin?: string,
): string {
  const base = baseId.trim();
  const originUf = origin?.toUpperCase().trim().slice(0, 2);
  if (originUf) return `${base}-${originUf}-${customerType}-${transactionType}`;
  return `${base}-${customerType}-${transactionType}`;
}

export function normalizeTaxRuleDisplayName(nome: string): string {
  return nome
    .replace(/\s*\((?:contribuinte.*|não contribuinte.*|envio de estoque.*)\)\s*$/i, "")
    .trim();
}

/** UF de origem fiscal da linha importada (prioriza coluna `uf` / sufixo do `ruleId`). */
export function taxRuleOriginUf(row: {
  origin?: string | null;
  uf?: string | null;
  ruleId?: string;
}): string {
  const uf = row.uf?.trim().toUpperCase() ?? "";
  if (/^[A-Z]{2}$/.test(uf)) return uf;

  const fromRuleId = row.ruleId?.match(TAX_RULE_ROW_WITH_ORIGIN);
  if (fromRuleId) return fromRuleId[2]!.toUpperCase();

  const origin = row.origin?.trim().toUpperCase() ?? "";
  if (/^[A-Z]{2}$/.test(origin)) return origin;

  return origin.slice(0, 2);
}
