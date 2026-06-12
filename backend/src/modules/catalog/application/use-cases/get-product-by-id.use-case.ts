import type { Product } from "../../domain/entities/product.entity.js";
import type { ProductRepository } from "../../domain/ports/product.repository.js";

export class GetProductByIdUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: string, tenantId: string): Promise<Product | null> {
    return this.productRepository.findById(id, tenantId);
  }
}
