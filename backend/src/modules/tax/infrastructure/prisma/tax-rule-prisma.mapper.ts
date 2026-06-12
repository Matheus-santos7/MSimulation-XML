import type { TaxRule } from "../../domain/entities/tax-rule.entity.js";

export function mapTaxRuleFromPrisma(row: {
  ruleId: string;
  nome: string;
  tipo: string;
  uf: string;
  origin: string | null;
  cfop: string;
  aliquota: string;
  transactionType: string | null;
  customerType: string | null;
  source: string;
  payload: unknown;
}): TaxRule {
  return {
    id: row.ruleId,
    nome: row.nome,
    tipo: row.tipo,
    uf: row.uf,
    origin: row.origin ?? undefined,
    cfop: row.cfop,
    aliquota: row.aliquota,
    transactionType: row.transactionType ?? undefined,
    customerType: row.customerType ?? undefined,
    source: row.source,
    payload: (row.payload as Record<string, unknown> | null) ?? undefined,
  };
}
