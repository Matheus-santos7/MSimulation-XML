/**
 * Controle de saldo de remessas físicas (FIFO) por linha de NF-e (`nfe_itens`).
 */
import { NFeTipo, type Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { fiscalNotDeleted } from "../shared/fiscal-service.js";

type Tx = Pick<PrismaClient, "nfeItem" | "nfeRemessaConsumo">;

export class SaldoRemessaInsuficienteError extends Error {
  constructor(
    public readonly productId: string,
    public readonly solicitado: number,
    public readonly disponivel: number,
  ) {
    super(
      `Saldo de remessa insuficiente para o produto. Solicitado: ${solicitado}, disponível: ${disponivel}. Emita nova remessa ou reduza a quantidade.`,
    );
    this.name = "SaldoRemessaInsuficienteError";
  }
}

export function remessaItemSaldoWhere(
  tenantId: string,
  productId: string,
  unidadeDestinoId?: string,
): Prisma.NfeItemWhereInput {
  return {
    tenantId,
    productId,
    saldoDisponivel: { gt: 0 },
    nfe: {
      tenantId,
      tipo: NFeTipo.REMESSA,
      ...fiscalNotDeleted,
      ...(unidadeDestinoId ? { unidadeDestinoId } : {}),
    },
  };
}

const remessaSaldoNfeWhere = (tenantId: string) => ({
  tenantId,
  tipo: NFeTipo.REMESSA,
  ...fiscalNotDeleted,
});

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

    const fifoBySku = await prisma.nfeItem.findMany({
      where: {
        tenantId,
        saldoDisponivel: { gt: 0 },
        product: { sku },
        nfe: remessaSaldoNfeWhere(tenantId),
      },
      select: { productId: true },
      distinct: ["productId"],
    });
    for (const row of fifoBySku) ids.add(row.productId);
  }

  return [...ids];
}

/**
 * Alinha `nfe_itens.product_id` ao cadastro atual da empresa (por SKU).
 * Corrige saldo FIFO legado após reimportação de produtos ou troca de tenant.
 */
export async function realignRemessaFifoProductIdsBySku(
  prisma: Pick<PrismaClient, "product" | "nfeItem">,
  tenantId: string,
  sku: string,
): Promise<{ atualizados: number; productId: string | null }> {
  const skuNorm = sku.trim();
  if (!skuNorm) return { atualizados: 0, productId: null };

  const cadastro = await prisma.product.findFirst({
    where: { tenantId, sku: skuNorm },
    select: { id: true },
  });
  if (!cadastro) return { atualizados: 0, productId: null };

  const result = await prisma.nfeItem.updateMany({
    where: {
      tenantId,
      productId: { not: cadastro.id },
      saldoDisponivel: { gt: 0 },
      product: { sku: skuNorm },
      nfe: remessaSaldoNfeWhere(tenantId),
    },
    data: { productId: cadastro.id },
  });

  return { atualizados: result.count, productId: cadastro.id };
}

export async function saldoRemessaDisponivel(
  prisma: PrismaClient,
  tenantId: string,
  productId: string,
  unidadeDestinoId?: string,
): Promise<number> {
  const rows = await prisma.nfeItem.findMany({
    where: remessaItemSaldoWhere(tenantId, productId, unidadeDestinoId),
    select: { saldoDisponivel: true },
  });
  return rows.reduce((acc, r) => acc + (r.saldoDisponivel ?? 0), 0);
}

export type SaldoRemessaCdRow = {
  unidadeDestinoId: string;
  productId: string;
  saldo: number;
  unidade: {
    codigo: string;
    nome: string;
    uf: string;
  } | null;
};

/** Saldo FIFO agregado por CD (unidade destino da remessa física). */
export async function listarSaldoRemessaPorCd(
  prisma: PrismaClient,
  tenantId: string,
  productId: string,
  productSku?: string,
): Promise<SaldoRemessaCdRow[]> {
  const productIds = await collectRemessaSaldoProductIds(
    prisma,
    tenantId,
    productId,
    productSku,
  );
  const rows = await prisma.nfeItem.findMany({
    where: {
      tenantId,
      productId: { in: productIds },
      saldoDisponivel: { gt: 0 },
      nfe: remessaSaldoNfeWhere(tenantId),
    },
    select: {
      productId: true,
      saldoDisponivel: true,
      nfe: {
        select: {
          unidadeDestinoId: true,
          unidadeDestino: {
            select: { codigo: true, nome: true, uf: true },
          },
        },
      },
    },
  });

  const byCd = new Map<
    string,
    { saldo: number; unidade: SaldoRemessaCdRow["unidade"] }
  >();

  for (const row of rows) {
    const cdId = row.nfe.unidadeDestinoId;
    if (!cdId) continue;
    const qty = row.saldoDisponivel ?? 0;
    if (qty <= 0) continue;

    const prev = byCd.get(cdId);
    byCd.set(cdId, {
      saldo: (prev?.saldo ?? 0) + qty,
      unidade: row.nfe.unidadeDestino ?? prev?.unidade ?? null,
    });
  }

  return [...byCd.entries()]
    .map(([unidadeDestinoId, { saldo, unidade }]) => ({
      unidadeDestinoId,
      productId,
      saldo,
      unidade,
    }))
    .sort((a, b) => {
      const codA = a.unidade?.codigo ?? "";
      const codB = b.unidade?.codigo ?? "";
      return codA.localeCompare(codB);
    });
}

async function listarItensRemessaFifo(
  tx: Tx,
  tenantId: string,
  productId: string,
  unidadeDestinoId?: string,
) {
  return tx.nfeItem.findMany({
    where: remessaItemSaldoWhere(tenantId, productId, unidadeDestinoId),
    orderBy: [{ nfe: { emitidaEm: "asc" } }, { nfe: { numero: "asc" } }, { numeroItem: "asc" }],
  });
}

export async function consumirSaldoRemessaFifo(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantidade: number,
  retornoNfeId: string,
  unidadeDestinoId?: string,
): Promise<{ remessaNfeId: string; quantidade: number; nfeItemId: string }[]> {
  const itens = await listarItensRemessaFifo(tx, tenantId, productId, unidadeDestinoId);

  let restante = quantidade;
  const alocacoes: { remessaNfeId: string; quantidade: number; nfeItemId: string }[] = [];

  for (const item of itens) {
    if (restante <= 0) break;
    const saldo = item.saldoDisponivel ?? 0;
    if (saldo <= 0) continue;

    const consumir = Math.min(restante, saldo);
    await tx.nfeItem.update({
      where: { id: item.id },
      data: { saldoDisponivel: saldo - consumir },
    });
    await tx.nfeRemessaConsumo.create({
      data: {
        retornoNfeId,
        remessaNfeId: item.nfeId,
        nfeItemId: item.id,
        quantidade: consumir,
      },
    });
    alocacoes.push({ remessaNfeId: item.nfeId, quantidade: consumir, nfeItemId: item.id });
    restante -= consumir;
  }

  if (restante > 0) {
    const disponivel = quantidade - restante;
    throw new SaldoRemessaInsuficienteError(productId, quantidade, disponivel);
  }

  return alocacoes;
}

export async function debitarSaldoRemessaPorCd(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantidade: number,
  unidadeDestinoId: string,
): Promise<{ remessaNfeId: string; quantidade: number; nfeItemId: string }[]> {
  const itens = await listarItensRemessaFifo(tx, tenantId, productId, unidadeDestinoId);

  let restante = quantidade;
  const alocacoes: { remessaNfeId: string; quantidade: number; nfeItemId: string }[] = [];

  for (const item of itens) {
    if (restante <= 0) break;
    const saldo = item.saldoDisponivel ?? 0;
    if (saldo <= 0) continue;

    const consumir = Math.min(restante, saldo);
    await tx.nfeItem.update({
      where: { id: item.id },
      data: { saldoDisponivel: saldo - consumir },
    });
    alocacoes.push({ remessaNfeId: item.nfeId, quantidade: consumir, nfeItemId: item.id });
    restante -= consumir;
  }

  if (restante > 0) {
    const disponivel = quantidade - restante;
    throw new SaldoRemessaInsuficienteError(productId, quantidade, disponivel);
  }

  return alocacoes;
}

export async function estornarConsumosRemessa(
  tx: Tx,
  retornoNfeId: string,
): Promise<{ remessaNfeId: string; quantidade: number; nfeItemId: string }[]> {
  const consumos = await tx.nfeRemessaConsumo.findMany({
    where: { retornoNfeId },
  });
  const estornos: { remessaNfeId: string; quantidade: number; nfeItemId: string }[] = [];
  for (const consumo of consumos) {
    await tx.nfeItem.update({
      where: { id: consumo.nfeItemId },
      data: { saldoDisponivel: { increment: consumo.quantidade } },
    });
    estornos.push({
      remessaNfeId: consumo.remessaNfeId,
      quantidade: consumo.quantidade,
      nfeItemId: consumo.nfeItemId,
    });
  }
  return estornos;
}
