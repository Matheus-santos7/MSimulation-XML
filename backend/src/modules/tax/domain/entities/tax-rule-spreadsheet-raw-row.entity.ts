/**
 * Linha bruta da planilha ML após leitura estrutural (sem classificação tributária).
 */
export type TaxRuleSpreadsheetRawRow = {
  line: number;
  /** Valores por coluna (chaves da linha 2 da planilha, ex.: RULE_ID, IPI_ST). */
  cells: Record<string, unknown>;
  ruleId: string;
  ruleName: string;
  origin: string;
  transactionTypeLabel: string;
};
