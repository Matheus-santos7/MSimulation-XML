import type { Product } from "../../domain/entities/product.entity.js";
import type { ProductRepository } from "../../domain/ports/product.repository.js";

/**
 * Lista todos os produtos do tenant ordenados por SKU.
 *
 * @param tenantId - Tenant emitente
 * @returns Array de produtos do catálogo
 */
export class ListProductsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(tenantId: string): Promise<Product[]> {
    return this.productRepository.listByTenant(tenantId);
  }
}
