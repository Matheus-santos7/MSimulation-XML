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
