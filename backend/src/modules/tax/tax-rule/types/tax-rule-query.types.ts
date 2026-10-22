import type { CustomerType, TransactionType } from "../../tax-calculation/types/tax-types.types.js";

/** Parâmetros de resolução de regra (origem × destino × operação). */
export type ResolveTaxRuleParams = {
  originUf: string;
  destinationUf: string;
  transactionType: TransactionType;
  customerType: CustomerType;
  ruleBaseId?: string;
};

/** Resultado do bulk upsert de regras. */
export type BulkUpsertTaxRulesResult = {
  created: number;
  updated: number;
  total: number;
};
