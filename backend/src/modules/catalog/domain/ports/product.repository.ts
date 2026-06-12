import type { Product } from "../entities/product.entity.js";

export type ProductWriteData = {
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

export type ProductSkuIndexEntry = {
  id: string;
  estoque: number;
};

/** Persistence port for catalog products. */
export interface ProductRepository {
  listByTenant(tenantId: string): Promise<Product[]>;
  findById(id: string, tenantId: string): Promise<Product | null>;
  getTenantUf(tenantId: string): Promise<string>;
  create(tenantId: string, data: ProductWriteData): Promise<Product>;
  update(id: string, data: Partial<ProductWriteData>): Promise<Product>;
  listSkuIndex(tenantId: string): Promise<Map<string, ProductSkuIndexEntry>>;
  countInvoicedOrders(productId: string): Promise<number>;
  deleteProductAndDraftOrders(productId: string): Promise<void>;
}
