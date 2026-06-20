import {
  collectRemessaSaldoProductIds,
  buildRemessaFifoItemWhere,
} from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import type { AdvanceProductResolved } from "../../domain/entities/advance-product.entity.js";
import type { AdvanceProductResolverPort } from "../../domain/ports/advance-product-resolver.port.js";

/**
 * Resolve produto do catálogo e ID FIFO para avanço entre CDs.
 *
 * Alinha `productId` do UI com IDs legados em `nfe_item` via SKU e saldo remessa.
 */
export class AdvanceProductResolverAdapter implements AdvanceProductResolverPort {
  private get db() {
    return getDbClient();
  }

  /**
   * @inheritdoc
   */
  async resolveForAdvance(
    tenantId: string,
    productId: string,
    productSku?: string,
  ): Promise<AdvanceProductResolved | null> {
    const sku = productSku?.trim();
    let product = await this.findProductInTenant(tenantId, { productId, sku });

    const fifoIds = await collectRemessaSaldoProductIds(this.db, tenantId, productId, sku);
    const fifoProductId =
      (await this.findFifoProductIdWithSaldo(tenantId, fifoIds)) ?? productId;

    if (!product && fifoProductId) {
      const linha = await this.db.nfeItem.findFirst({
        where: buildRemessaFifoItemWhere(tenantId, fifoProductId),
        include: { product: true },
      });
      const legacy = linha?.product;
      if (legacy) {
        product =
          legacy.tenantId === tenantId
            ? legacy
            : await this.findProductInTenant(tenantId, { sku: legacy.sku });
      }
    }

    if (!product) return null;

    return {
      productId: product.id,
      fifoProductId,
      sku: product.sku,
      tenantId: product.tenantId,
    };
  }

  /**
   * @inheritdoc
   */
  async hasStockForAdvance(
    tenantId: string,
    productId: string,
    productSku?: string,
  ): Promise<boolean> {
    const fifoIds = await collectRemessaSaldoProductIds(
      this.db,
      tenantId,
      productId,
      productSku,
    );
    for (const fid of fifoIds) {
      const linha = await this.db.nfeItem.findFirst({
        where: buildRemessaFifoItemWhere(tenantId, fid),
        select: { id: true },
      });
      if (linha) return true;
    }
    return false;
  }

  /** Busca produto no tenant por SKU (prioritário) ou por ID. */
  private async findProductInTenant(
    tenantId: string,
    opts: { productId?: string; sku?: string },
  ) {
    const sku = opts.sku?.trim();
    if (sku) {
      const bySku = await this.db.product.findFirst({ where: { tenantId, sku } });
      if (bySku) return bySku;
    }
    if (opts.productId) {
      return this.db.product.findFirst({
        where: { id: opts.productId, tenantId },
      });
    }
    return null;
  }

  /** Primeiro productId na lista FIFO que ainda tem saldo em `nfe_item`. */
  private async findFifoProductIdWithSaldo(
    tenantId: string,
    productIds: string[],
  ): Promise<string | null> {
    for (const fid of productIds) {
      const linha = await this.db.nfeItem.findFirst({
        where: buildRemessaFifoItemWhere(tenantId, fid),
        select: { productId: true },
        orderBy: [{ nfe: { emitidaEm: "asc" } }, { numeroItem: "asc" }],
      });
      if (linha) return linha.productId;
    }
    return null;
  }
}
