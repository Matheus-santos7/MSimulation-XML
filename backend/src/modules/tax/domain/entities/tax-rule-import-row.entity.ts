export type TaxRuleImportRow = {
  ruleId: string;
  nome: string;
  tipo: string;
  uf: string;
  cfop: string;
  aliquota: string;
  transactionType?: string;
  customerType?: string;
  origin?: string;
  payload?: Record<string, unknown>;
};
