import type { AdvanceProductResolverPort } from "../../domain/ports/advance-product-resolver.port.js";

export class ResolveAdvanceProductUseCase {
  constructor(private readonly advanceProductResolver: AdvanceProductResolverPort) {}

  execute(tenantId: string, productId: string, productSku?: string) {
    return this.advanceProductResolver.resolveForAdvance(tenantId, productId, productSku);
  }
}
