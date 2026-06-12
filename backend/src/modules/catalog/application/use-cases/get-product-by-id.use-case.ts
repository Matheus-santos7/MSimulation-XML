import type { Product } from "../../domain/entities/product.entity.js";
import type { ProductRepository } from "../../domain/ports/product.repository.js";

/**
 * Obtém detalhe de um produto por ID com isolamento por tenant.
 *
 * @param id - UUID do produto
 * @param tenantId - Tenant do utilizador autenticado
 * @returns Produto ou `null` se não existir neste tenant
 */
export class GetProductByIdUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: string, tenantId: string): Promise<Product | null> {
    return this.productRepository.findById(id, tenantId);
  }
}
