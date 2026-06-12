import type {
  ListProductMovementsFilter,
  ProductMovementRepository,
} from "../../domain/ports/product-movement.repository.js";

export class ListProductMovementsUseCase {
  constructor(private readonly productMovementRepository: ProductMovementRepository) {}

  execute(tenantId: string, filter?: ListProductMovementsFilter) {
    return this.productMovementRepository.listByTenant(tenantId, filter);
  }
}
