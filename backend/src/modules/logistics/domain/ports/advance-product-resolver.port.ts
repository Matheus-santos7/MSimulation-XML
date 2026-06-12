import type { AdvanceProductResolved } from "../entities/advance-product.entity.js";

export interface AdvanceProductResolverPort {
  resolveForAdvance(
    tenantId: string,
    productId: string,
    productSku?: string,
  ): Promise<AdvanceProductResolved | null>;
  hasStockForAdvance(
    tenantId: string,
    productId: string,
    productSku?: string,
  ): Promise<boolean>;
}
