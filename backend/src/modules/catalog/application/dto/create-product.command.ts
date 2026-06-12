/**
 * Comando de criação de produto (entrada do use case / body HTTP validado por Zod).
 *
 * Campos fiscais (NCM, CEST, origem) e comerciais (preço, custo, estoque).
 * `taxRuleBaseId` é opcional na criação mas necessário para emissão posterior.
 */
export type CreateProductCommand = {
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
  estoque?: number;
  taxRuleBaseId?: string;
};
