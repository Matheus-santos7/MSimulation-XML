/**
 * Regra fiscal persistida (`tax_rule`) — visão de listagem/admin.
 *
 * Cada linha da planilha ML gera um `ruleId` composto:
 * `{baseId}-{customerType}-{transactionType}[-{originUf}]`
 *
 * O `payload` JSON guarda matriz `icmsByUf` com parâmetros por UF destino.
 */
export type TaxRule = {
  id: string;
  nome: string;
  tipo: string;
  uf: string;
  origin?: string;
  cfop: string;
  aliquota: string;
  transactionType?: string;
  customerType?: string;
  source: string;
  payload?: Record<string, unknown>;
};
