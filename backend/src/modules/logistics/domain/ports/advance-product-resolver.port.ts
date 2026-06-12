import type { AdvanceProductResolved } from "../entities/advance-product.entity.js";

/**
 * Port para resolver produto e saldo FIFO antes do avanço de mercadoria entre CDs.
 *
 * Trata divergência entre `productId` do formulário e IDs legados nas linhas de remessa.
 */
export interface AdvanceProductResolverPort {
  /**
   * Encontra produto no tenant e o `fifoProductId` com saldo disponível.
   * @returns `null` se produto não existir no catálogo do tenant
   */
  resolveForAdvance(
    tenantId: string,
    productId: string,
    productSku?: string,
  ): Promise<AdvanceProductResolved | null>;

  /**
   * Indica se há saldo FIFO mesmo quando o produto não está no catálogo atual.
   * Usado para mensagens de erro mais específicas no controller.
   */
  hasStockForAdvance(
    tenantId: string,
    productId: string,
    productSku?: string,
  ): Promise<boolean>;
}
