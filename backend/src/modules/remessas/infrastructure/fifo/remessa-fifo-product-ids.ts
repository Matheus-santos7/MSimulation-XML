import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import { fiscalNotDeleted } from "../../../fiscal-documents/domain/constants/fiscal-not-deleted.js";
import { REMESSA_FIFO_TIPOS, buildRemessaFifoNfeWhere } from "./remessa-fifo.constants.js";
import type { RemessaFifoPrisma } from "./remessa-fifo.types.js";

export function buildRemessaFifoItemWhere(
  tenantId: string,
  productId: string,
  unidadeDestinoId?: string,
): Prisma.NfeItemWhereInput {
  return buildRemessaFifoItemWhereMulti(tenantId, [productId], unidadeDestinoId);
}

/** Mesmo critério da listagem de saldo por CD — aceita cadastro + IDs legados do SKU. */
export function buildRemessaFifoItemWhereMulti(
  tenantId: string,
  productIds: string[],
  unidadeDestinoId?: string,
): Prisma.NfeItemWhereInput {
  if (productIds.length === 0) {
    return { id: { in: [] } };
  }
  return {
    tenantId,
    productId: productIds.length === 1 ? productIds[0]! : { in: productIds },
    saldoDisponivel: { gt: 0 },
    nfe: {
      tenantId,
      tipo: { in: REMESSA_FIFO_TIPOS },
      ...fiscalNotDeleted,
      ...(unidadeDestinoId ? { unidadeDestinoId } : {}),
    },
  };
}

export async function buildRemessaFifoItemsWhere(
  prisma: Pick<PrismaClient, "product" | "nfeItem">,
  tenantId: string,
  productId: string,
  productSku?: string,
  unidadeDestinoId?: string,
): Promise<Prisma.NfeItemWhereInput> {
  const productIds = await collectRemessaSaldoProductIds(
    prisma,
    tenantId,
    productId,
    productSku,
  );
  return buildRemessaFifoItemWhereMulti(tenantId, productIds, unidadeDestinoId);
}

/** IDs de produto que podem ter saldo FIFO (cadastro + linhas legadas pelo SKU). */
export async function collectRemessaSaldoProductIds(
  prisma: Pick<PrismaClient, "product" | "nfeItem">,
  tenantId: string,
  productId: string,
  productSku?: string,
): Promise<string[]> {
  const ids = new Set<string>();
  if (productId) ids.add(productId);

  const sku = productSku?.trim();
  if (sku) {
    const cadastro = await prisma.product.findFirst({
      where: { tenantId, sku },
      select: { id: true },
    });
    if (cadastro) ids.add(cadastro.id);
  }

  const orFilters: Prisma.NfeItemWhereInput[] = [];
  if (productId) orFilters.push({ productId });
  if (sku) orFilters.push({ product: { sku } });

  if (orFilters.length > 0) {
    const fifoRows = await prisma.nfeItem.findMany({
      where: {
        tenantId,
        nfe: buildRemessaFifoNfeWhere(tenantId),
        OR: orFilters,
      },
      select: { productId: true },
      distinct: ["productId"],
    });
    for (const row of fifoRows) ids.add(row.productId);
  }

  return [...ids];
}

/**
 * Alinha `nfe_itens.product_id` ao cadastro atual da empresa (por SKU).
 * Corrige saldo FIFO legado após reimportação de produtos ou troca de tenant.
 */
export async function realignRemessaFifoProductIdsBySku(
  db: Pick<RemessaFifoPrisma, "product" | "nfeItem">,
  tenantId: string,
  sku: string,
): Promise<{ atualizados: number; productId: string | null }> {
  const skuNorm = sku.trim();
  if (!skuNorm) return { atualizados: 0, productId: null };

  const cadastro = await db.product.findFirst({
    where: { tenantId, sku: skuNorm },
    select: { id: true },
  });
  if (!cadastro) return { atualizados: 0, productId: null };

  const result = await db.nfeItem.updateMany({
    where: {
      tenantId,
      productId: { not: cadastro.id },
      saldoDisponivel: { gt: 0 },
      product: { sku: skuNorm },
      nfe: buildRemessaFifoNfeWhere(tenantId),
    },
    data: { productId: cadastro.id },
  });

  return { atualizados: result.count, productId: cadastro.id };
}
