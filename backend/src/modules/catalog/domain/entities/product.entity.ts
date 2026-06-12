/**
 * Produto do catálogo fiscal persistido em `product`.
 *
 * Regras de negócio relevantes:
 * - `sku` é único por tenant (chave natural para bulk upsert e integrações ML).
 * - `taxRuleBaseId` opcional vincula o produto a uma regra tributária do módulo **tax**;
 *   obrigatório para emissão fiscal (Sales Chain valida antes de emitir).
 * - `preco` é o preço de venda; `precoCusto` alimenta retorno simbólico e cálculos inbound.
 * - `estoque` é informativo no catálogo; movimentações fiscais usam FIFO de remessas.
 */
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
