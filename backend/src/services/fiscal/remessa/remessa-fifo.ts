/**
 * Controle de saldo de remessas físicas (FIFO) por linha de NF-e (`nfe_itens`).
 */
import { NFeTipo, type Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { fiscalNotDeleted } from "../shared/fiscal-service.js";

type Tx = Pick<PrismaClient, "nfeItem" | "nfeRemessaConsumo" | "product">;

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
  return remessaItemSaldoWhereMulti(tenantId, [productId], unidadeDestinoId);
}

/** Mesmo critério da listagem de saldo por CD — aceita cadastro + IDs legados do SKU. */
export function remessaItemSaldoWhereMulti(
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

export async function remessaSaldoItensWhere(
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
  return remessaItemSaldoWhereMulti(tenantId, productIds, unidadeDestinoId);
}

/** Saldo FIFO: remessa física + remessa simbólica (avanço entre CDs). */
const REMESSA_FIFO_TIPOS: NFeTipo[] = [NFeTipo.REMESSA, NFeTipo.REMESSA_SIMBOLICA];

const remessaSaldoNfeWhere = (tenantId: string) => ({
  tenantId,
  tipo: { in: REMESSA_FIFO_TIPOS },
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
        product: { sku, tenantId },
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
  productSku?: string,
): Promise<number> {
  const where = await remessaSaldoItensWhere(
    prisma,
    tenantId,
    productId,
    productSku,
    unidadeDestinoId,
  );
  const rows = await prisma.nfeItem.findMany({
    where,
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

/**
 * ID gravado nas NF-es de remessa (`unidade_destino_id`) para debitar FIFO no CD origem.
 * Se o catálogo de CDs foi reimportado, o UUID do dropdown pode divergir do das notas antigas;
 * nesse caso casa pelo código (ex.: SP02).
 */
/**
 * CD ativo do catálogo para metadados fiscais do avanço.
 * O saldo FIFO pode estar em NF-es com `unidade_destino_id` legado/inativo.
 */
export async function resolveOrigemFiscalParaAvanco(
  prisma: PrismaClient,
  tenantId: string,
  productId: string,
  unidadeOrigemId: string,
  productSku: string | undefined,
  obterAtiva: (id: string) => Promise<{ id: string; codigo: string; uf: string; nome: string } | null>,
  obterAtivaPorCodigo: (codigo: string) => Promise<{ id: string; codigo: string; uf: string; nome: string } | null>,
): Promise<{ origem: { id: string; codigo: string; uf: string; nome: string }; fifoOrigemId: string } | null> {
  const saldos = await listarSaldoRemessaPorCd(prisma, tenantId, productId, productSku);

  const direta = await obterAtiva(unidadeOrigemId);
  const codigoDireto = direta?.codigo;
  let fifoOrigemId: string;
  try {
    fifoOrigemId = await resolveUnidadeFifoOrigemId(
      prisma,
      tenantId,
      productId,
      unidadeOrigemId,
      codigoDireto ?? saldos.find((s) => s.unidadeDestinoId === unidadeOrigemId)?.unidade?.codigo ?? "",
      productSku,
    );
  } catch (e) {
    if (e instanceof SaldoRemessaInsuficienteError) return null;
    throw e;
  }

  if (direta) {
    return { origem: direta, fifoOrigemId };
  }

  const saldoRow = saldos.find((s) => s.unidadeDestinoId === fifoOrigemId);
  const codigoSaldo = saldoRow?.unidade?.codigo?.trim();
  if (codigoSaldo) {
    const porCodigo = await obterAtivaPorCodigo(codigoSaldo);
    if (porCodigo) {
      return { origem: porCodigo, fifoOrigemId };
    }
  }

  return null;
}

export async function resolveUnidadeFifoOrigemId(
  prisma: PrismaClient,
  tenantId: string,
  productId: string,
  unidadeOrigemId: string,
  unidadeOrigemCodigo: string,
  productSku?: string,
): Promise<string> {
  const saldos = await listarSaldoRemessaPorCd(prisma, tenantId, productId, productSku);
  const direct = saldos.find((s) => s.unidadeDestinoId === unidadeOrigemId && s.saldo > 0);
  if (direct) return unidadeOrigemId;

  const codigo = unidadeOrigemCodigo.trim().toUpperCase();
  const byCodigo = saldos.find(
    (s) => s.unidade?.codigo?.trim().toUpperCase() === codigo && s.saldo > 0,
  );
  if (byCodigo) return byCodigo.unidadeDestinoId;

  const total = saldos.reduce((acc, s) => acc + s.saldo, 0);
  if (total <= 0) return unidadeOrigemId;

  throw new SaldoRemessaInsuficienteError(
    productId,
    1,
    saldos.find((s) => s.unidadeDestinoId === unidadeOrigemId)?.saldo ?? 0,
  );
}

/** Saldo FIFO agregado por CD (unidade destino da remessa física). */
export async function listarSaldoRemessaPorCd(
  prisma: PrismaClient,
  tenantId: string,
  productId: string,
  productSku?: string,
): Promise<SaldoRemessaCdRow[]> {
  const where = await remessaSaldoItensWhere(prisma, tenantId, productId, productSku);
  const rows = await prisma.nfeItem.findMany({
    where,
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
  productSku?: string,
) {
  const where = await remessaSaldoItensWhere(
    tx,
    tenantId,
    productId,
    productSku,
    unidadeDestinoId,
  );
  return tx.nfeItem.findMany({
    where,
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
  productSku?: string,
): Promise<{ remessaNfeId: string; quantidade: number; nfeItemId: string }[]> {
  const itens = await listarItensRemessaFifo(
    tx,
    tenantId,
    productId,
    unidadeDestinoId,
    productSku,
  );

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
