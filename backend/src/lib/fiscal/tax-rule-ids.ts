export type CustomerType = "taxpayer" | "non_taxpayer";
export type TransactionType = "sale" | "inbound";

const TAX_RULE_ROW_SUFFIX = /-(taxpayer|non_taxpayer)-(sale|inbound)$/i;
const TAX_RULE_ROW_WITH_ORIGIN = /^(.+)-([A-Z]{2})-(taxpayer|non_taxpayer)-(sale|inbound)$/i;
const TAX_RULE_ROW_LEGACY = /^(.+)-(taxpayer|non_taxpayer)-(sale|inbound)$/i;

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
