import type { AdvanceProductResolverPort } from "../../domain/ports/advance-product-resolver.port.js";

/**
 * Resolve produto e ID FIFO para o avanço de mercadoria entre CDs.
 *
 * Chamado por `movementController` antes de delegar ao módulo **remessas**.
 *
 * @param tenantId - Tenant emitente
 * @param productId - ID do produto no formulário
 * @param productSku - SKU opcional para realinhamento e busca alternativa
 * @returns {@link AdvanceProductResolved} ou `null` se produto ausente no catálogo
 */
export class ResolveAdvanceProductUseCase {
  constructor(private readonly advanceProductResolver: AdvanceProductResolverPort) {}

  execute(tenantId: string, productId: string, productSku?: string) {
    return this.advanceProductResolver.resolveForAdvance(tenantId, productId, productSku);
  }
}
