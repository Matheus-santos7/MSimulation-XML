import { Inject, Injectable } from "@nestjs/common";
import { AdvanceProductResolver } from "./advance-product.resolver.js";
import { ProductMovementRepository } from "./product-movement.repository.js";
import type { ProductMovement } from "./product-movement.types.js";
import type { AdvanceProductResolved } from "./types/advance-product.types.js";
import type {
  ListProductMovementsFilter,
  RegisterProductMovementData,
} from "./types/product-movement-query.types.js";

/** Movimentações de produto e resolução do produto no avanço entre CDs. */
@Injectable()
export class ProductMovementService {
  constructor(
    @Inject(ProductMovementRepository) private readonly repository: ProductMovementRepository,
    @Inject(AdvanceProductResolver) private readonly advanceProducts: AdvanceProductResolver,
  ) {}

  list(tenantId: string, filter: ListProductMovementsFilter = {}): Promise<ProductMovement[]> {
    return this.repository.listByTenant(tenantId, filter);
  }

  /** Grava a movimentação; aceita a transação da emissão (`db`). */
  register(data: RegisterProductMovementData, db?: unknown): Promise<void> {
    return this.repository.register(data, db);
  }

  resolveAdvanceProduct(
    tenantId: string,
    productId: string,
    productSku?: string,
  ): Promise<AdvanceProductResolved | null> {
    return this.advanceProducts.resolveForAdvance(tenantId, productId, productSku);
  }

  hasAdvanceStock(tenantId: string, productId: string, productSku?: string): Promise<boolean> {
    return this.advanceProducts.hasStockForAdvance(tenantId, productId, productSku);
  }
}
