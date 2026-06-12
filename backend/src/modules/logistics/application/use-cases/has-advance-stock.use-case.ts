import type { AdvanceProductResolverPort } from "../../domain/ports/advance-product-resolver.port.js";

/**
 * Verifica se existe saldo FIFO para avanço mesmo sem produto no catálogo atual.
 *
 * Permite ao controller distinguir "sem stock" de "stock legado sem SKU cadastrado".
 *
 * @param tenantId - Tenant emitente
 * @param productId - ID informado no formulário
 * @param productSku - SKU opcional
 * @returns `true` se há linha `nfe_item` com saldo para avanço
 */
export class HasAdvanceStockUseCase {
  constructor(private readonly advanceProductResolver: AdvanceProductResolverPort) {}

  execute(tenantId: string, productId: string, productSku?: string) {
    return this.advanceProductResolver.hasStockForAdvance(tenantId, productId, productSku);
  }
}
