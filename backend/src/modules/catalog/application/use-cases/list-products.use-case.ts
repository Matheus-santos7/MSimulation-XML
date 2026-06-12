import type { Product } from "../../domain/entities/product.entity.js";
import type { ProductRepository } from "../../domain/ports/product.repository.js";

export class ListProductsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(tenantId: string): Promise<Product[]> {
    return this.productRepository.listByTenant(tenantId);
  }
}
