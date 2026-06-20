import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { fiscalNotDeleted } from "../../../fiscal-documents/domain/constants/fiscal-not-deleted.js";
import { REMESSA_FIFO_TIPOS, buildRemessaFifoNfeWhere } from "./remessa-fifo.constants.js";
import {
  collectRemessaSaldoProductIds,
  realignRemessaFifoProductIdsBySku,
} from "./remessa-fifo-product-ids.js";
import type { RemessaFifoPrisma } from "./remessa-fifo.types.js";

/** Saldo líquido quando a nota ainda não tem linhas em `nfe_itens`. */
export async function getNetBalanceWithoutNfeItems(
  prisma: Pick<PrismaClient, "nfeRemessaConsumo">,
  nfeId: string,
  quantidade: number,
): Promise<number> {
  const consumido = await prisma.nfeRemessaConsumo.aggregate({
    where: { remessaNfeId: nfeId },
    _sum: { quantidade: true },
  });
  return Math.max(0, quantidade - (consumido._sum.quantidade ?? 0));
}

/**
 * Remessas físicas/simbólicas sem `nfe_itens` não apareciam no saldo FIFO.
 * Recria a linha com saldo líquido (quantidade − consumos já registrados).
 */
async function ensureRemessaFifoItemsForNotes(
  prisma: RemessaFifoPrisma,
  tenantId: string,
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) return;

  const notasSemItem = await prisma.nFe.findMany({
    where: {
      tenantId,
      tipo: { in: REMESSA_FIFO_TIPOS },
      ...fiscalNotDeleted,
      productId: productIds.length === 1 ? productIds[0]! : { in: productIds },
      itens: { none: {} },
    },
    select: {
      id: true,
      productId: true,
      quantidade: true,
      valor: true,
      valorIcms: true,
      ncm: true,
      cfop: true,
    },
  });

  for (const nfe of notasSemItem) {
    if (!nfe.productId) continue;
    const saldo = await getNetBalanceWithoutNfeItems(prisma, nfe.id, nfe.quantidade);
    if (saldo <= 0) continue;

    await prisma.nfeItem.create({
      data: {
        tenantId,
        nfeId: nfe.id,
        productId: nfe.productId,
        numeroItem: 1,
        quantidade: nfe.quantidade,
        valor: nfe.valor,
        valorIcms: nfe.valorIcms,
        ncm: nfe.ncm,
        cfop: nfe.cfop,
        saldoDisponivel: saldo,
      },
    });
  }
}

/**
 * Corrige `saldo_disponivel` a partir dos consumos (`nfe_remessa_consumos`).
 * Evita saldo zerado na UI quando o débito FIFO e os consumos divergem.
 */
async function reconcileRemessaFifoItems(
  prisma: Pick<RemessaFifoPrisma, "nfeItem" | "nfeRemessaConsumo">,
  tenantId: string,
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) return;

  const itens = await prisma.nfeItem.findMany({
    where: {
      tenantId,
      productId: productIds.length === 1 ? productIds[0]! : { in: productIds },
      nfe: buildRemessaFifoNfeWhere(tenantId),
    },
    select: {
      id: true,
      quantidade: true,
      saldoDisponivel: true,
      nfe: { select: { quantidade: true } },
    },
  });

  for (const item of itens) {
    const consumido = await prisma.nfeRemessaConsumo.aggregate({
      where: { nfeItemId: item.id },
      _sum: { quantidade: true },
    });
    const totalConsumido = consumido._sum.quantidade ?? 0;
    const qtyBase =
      item.quantidade > 0
        ? item.quantidade
        : item.nfe.quantidade > 0
          ? item.nfe.quantidade
          : (item.saldoDisponivel ?? 0) + totalConsumido;
    if (qtyBase <= 0) continue;

    const esperado = Math.max(0, qtyBase - totalConsumido);
    if ((item.saldoDisponivel ?? 0) !== esperado) {
      await prisma.nfeItem.update({
        where: { id: item.id },
        data: { saldoDisponivel: esperado },
      });
    }
  }
}

async function prepareRemessaFifoBalanceQuery(
  prisma: RemessaFifoPrisma,
  tenantId: string,
  productId: string,
  productSku?: string,
): Promise<string | undefined> {
  let sku = productSku?.trim();
  if (!sku && productId) {
    const cadastro = await prisma.product.findFirst({
      where: { tenantId, id: productId },
      select: { sku: true },
    });
    sku = cadastro?.sku?.trim() || undefined;
  }
  if (sku) {
    await realignRemessaFifoProductIdsBySku(prisma, tenantId, sku);
  }
  return sku;
}

/** Realinha product_id e recria `nfe_itens` faltantes antes de listar ou consumir FIFO. */
export async function prepareRemessaFifoForOperation(
  prisma: RemessaFifoPrisma,
  tenantId: string,
  productId: string,
  productSku?: string,
): Promise<string | undefined> {
  const sku = await prepareRemessaFifoBalanceQuery(prisma, tenantId, productId, productSku);
  const productIds = await collectRemessaSaldoProductIds(
    prisma,
    tenantId,
    productId,
    sku ?? productSku,
  );
  await ensureRemessaFifoItemsForNotes(prisma, tenantId, productIds);
  await reconcileRemessaFifoItems(prisma, tenantId, productIds);
  return sku;
}
