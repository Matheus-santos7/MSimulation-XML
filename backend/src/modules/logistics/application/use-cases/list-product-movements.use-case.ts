import type {
  ListProductMovementsFilter,
  ProductMovementRepository,
} from "../../domain/ports/product-movement.repository.js";

/**
 * Lista movimentações de produto do tenant (timeline operacional).
 *
 * @param tenantId - Tenant emitente
 * @param filter - `productId` opcional e `limit` (padrão 100)
 * @returns Movimentações com unidades e NF-e relacionadas
 */
export class ListProductMovementsUseCase {
  constructor(private readonly productMovementRepository: ProductMovementRepository) {}

  execute(tenantId: string, filter?: ListProductMovementsFilter) {
    return this.productMovementRepository.listByTenant(tenantId, filter);
  }
}
