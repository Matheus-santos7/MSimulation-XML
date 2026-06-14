import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import type { Product } from "../../../../generated/prisma/client.js";

export async function findProductInTenant(
  db: DbClient,
  tenantId: string,
  opts: { productId?: string; sku?: string },
): Promise<Product | null> {
  const sku = opts.sku?.trim();
  if (sku) {
    const bySku = await db.product.findFirst({ where: { tenantId, sku } });
    if (bySku) return bySku;
  }
  if (opts.productId) {
    return db.product.findFirst({
      where: { id: opts.productId, tenantId },
    });
  }
  return null;
}
