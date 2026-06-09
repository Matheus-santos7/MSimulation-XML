export type CustomerType = "taxpayer" | "non_taxpayer";
export type TransactionType = "sale" | "inbound";

/** RULE_ID da planilha (sem sufixo contribuinte/operação). */
export function taxRuleBaseIdFromRuleId(ruleId: string): string {
  const m = ruleId.match(/^(.+)-(taxpayer|non_taxpayer)-(sale|inbound)$/i);
  return m ? m[1]! : ruleId;
}

export function buildTaxRuleRowId(
  baseId: string,
  customerType: CustomerType,
  transactionType: TransactionType,
): string {
  return `${baseId.trim()}-${customerType}-${transactionType}`;
}

export function normalizeTaxRuleDisplayName(nome: string): string {
  return nome
    .replace(/\s*\((?:contribuinte.*|não contribuinte.*|envio de estoque.*)\)\s*$/i, "")
    .trim();
}
