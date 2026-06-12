/** Catalog product domain entity. */
export type Product = {
  id: string;
  tenantId: string;
  sku: string;
  ean?: string;
  nome: string;
  ncm: string;
  cest: string;
  exTipi?: string;
  origem: number;
  unidade: string;
  preco: number;
  precoCusto: number;
  estoque: number;
  taxRuleBaseId?: string;
};
