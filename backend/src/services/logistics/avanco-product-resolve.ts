import type { PrismaClient, Product } from "../../generated/prisma/client.js";
import {
  collectRemessaSaldoProductIds,
  remessaItemSaldoWhere,
} from "../fiscal/remessa/remessa-fifo.js";

export type AvancoProductResolved = {
  product: Product;
  /** ID gravado nas linhas FIFO (`nfe_itens`) — pode diferir do cadastro quando há legado. */
  fifoProductId: string;
};

async function findProductInTenant(
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

async function findFifoProductIdWithSaldo(
  prisma: PrismaClient,
  tenantId: string,
  productIds: string[],
): Promise<string | null> {
  for (const fid of productIds) {
    const linha = await prisma.nfeItem.findFirst({
      where: remessaItemSaldoWhere(tenantId, fid),
      select: { productId: true },
      orderBy: [{ nfe: { emitidaEm: "asc" } }, { numeroItem: "asc" }],
    });
    if (linha) return linha.productId;
  }
  return null;
}

/**
 * Resolve produto do cadastro alinhado ao saldo FIFO da remessa.
 * Prioriza SKU (estável no UI) e usa o product_id das linhas com saldo no débito.
 */
export async function resolveProductForAvanco(
  prisma: PrismaClient,
  tenantId: string,
  productId: string,
  productSku?: string,
): Promise<AvancoProductResolved | null> {
  const sku = productSku?.trim();
  let product = await findProductInTenant(prisma, tenantId, { productId, sku });

  const fifoIds = await collectRemessaSaldoProductIds(prisma, tenantId, productId, sku);
  const fifoProductId = (await findFifoProductIdWithSaldo(prisma, tenantId, fifoIds)) ?? productId;

  if (!product && fifoProductId) {
    const linha = await prisma.nfeItem.findFirst({
      where: remessaItemSaldoWhere(tenantId, fifoProductId),
      include: { product: true },
    });
    const legado = linha?.product;
    if (legado) {
      product =
        legado.tenantId === tenantId
          ? legado
          : await findProductInTenant(prisma, tenantId, { sku: legado.sku });
    }
  }

  if (!product) return null;

  return { product, fifoProductId };
}

export async function hasRemessaSaldoForAvanco(
  prisma: Pick<PrismaClient, "product" | "nfeItem">,
  tenantId: string,
  productId: string,
  productSku?: string,
): Promise<boolean> {
  const fifoIds = await collectRemessaSaldoProductIds(prisma, tenantId, productId, productSku);
  for (const fid of fifoIds) {
    const linha = await prisma.nfeItem.findFirst({
      where: remessaItemSaldoWhere(tenantId, fid),
      select: { id: true },
    });
    if (linha) return true;
  }
  return false;
}
