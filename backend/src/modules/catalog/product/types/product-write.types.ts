/**
 * Dados de escrita de produto (create/update/bulk).
 * Espelha os campos fiscais e comerciais exigidos pelo catálogo.
 */
export type ProductWriteData = {
  sku: string;
  ean?: string;
  nome: string;
  ncm: string;
  cest?: string | null;
  exTipi?: string;
  nfci?: string | null;
  origem: number;
  unidade: string;
  preco: number;
  precoCusto: number;
  estoque: number;
  sujeitoSt?: boolean;
  taxRuleBaseId?: string;
};

/**
 * Entrada do índice SKU → produto usado no bulk upsert.
 * Permite decidir create vs update sem consultar a BD por linha.
 */
export type ProductSkuIndexEntry = {
  id: string;
  estoque: number;
};

/**
 * Port de persistência do catálogo de produtos.
 *
 * Isola o domínio do Prisma; implementação em `PrismaProductRepository`.
 */
