import type { Product } from "../entities/product.entity.js";

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
export interface ProductRepository {
  /** Lista todos os produtos do tenant ordenados por SKU. */
  listByTenant(tenantId: string): Promise<Product[]>;

  /** Busca produto por ID com isolamento por tenant. */
  findById(id: string, tenantId: string): Promise<Product | null>;

  /** Obtém UF do emitente (validação de regra fiscal por estado). */
  getTenantUf(tenantId: string): Promise<string>;

  /**
   * Insere produto novo.
   * @throws {ProductConflictError} SKU duplicado no tenant
   */
  create(tenantId: string, data: ProductWriteData): Promise<Product>;

  /**
   * Atualiza campos parciais do produto.
   * @throws {ProductConflictError} SKU duplicado se alterado
   */
  update(id: string, data: Partial<ProductWriteData>): Promise<Product>;

  /** Mapa SKU → `{ id, estoque }` para upsert em massa numa única query inicial. */
  listSkuIndex(tenantId: string): Promise<Map<string, ProductSkuIndexEntry>>;

  /** Conta pedidos `FATURADO` vinculados (bloqueio de exclusão). */
  countInvoicedOrders(productId: string): Promise<number>;

  /**
   * Remove produto e pedidos em rascunho associados (transação).
   * @throws {ProductConflictError} FK impede exclusão
   */
  deleteProductAndDraftOrders(productId: string): Promise<void>;
}
