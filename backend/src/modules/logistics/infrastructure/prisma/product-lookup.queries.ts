import type { PrismaClient, Product } from "../../../../generated/prisma/client.js";

export async function findProductInTenant(
  prisma: PrismaClient,
  tenantId: string,
  opts: { productId?: string; sku?: string },
): Promise<Product | null> {
  const sku = opts.sku?.trim();
  if (sku) {
    const bySku = await prisma.product.findFirst({ where: { tenantId, sku } });
    if (bySku) return bySku;
  }
  if (opts.productId) {
    return prisma.product.findFirst({
      where: { id: opts.productId, tenantId },
    });
  }
  return null;
}
