/**
 * Controle de saldo de remessas físicas (FIFO) por linha de NF-e (`nfe_itens`).
 */
import { NFeTipo, type Prisma, type PrismaClient } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { fiscalNotDeleted } from "../../../fiscal-documents/domain/constants/fiscal-not-deleted.js";
import {
  ordenarFifoParaVenda,
  type DefaultCdContext,
} from "../../domain/services/ordenar-fifo-venda.js";

type Tx = Pick<PrismaTx, "nfeItem" | "nfeRemessaConsumo" | "product" | "nFe">;
type FifoPrisma = Pick<
  PrismaTx,
  | "nfeItem"
  | "product"
  | "nFe"
  | "meliUnidadeLogistica"
  | "nfeRemessaConsumo"
  | "tenantUnidadeLogistica"
>;

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
  }

  const orFilters: Prisma.NfeItemWhereInput[] = [];
  if (productId) orFilters.push({ productId });
  if (sku) orFilters.push({ product: { sku } });

  if (orFilters.length > 0) {
    const fifoRows = await prisma.nfeItem.findMany({
      where: {
        tenantId,
        nfe: remessaSaldoNfeWhere(tenantId),
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
  db: Pick<PrismaTx, "product" | "nfeItem">,
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
      nfe: remessaSaldoNfeWhere(tenantId),
    },
    data: { productId: cadastro.id },
  });

  return { atualizados: result.count, productId: cadastro.id };
}

export async function saldoRemessaDisponivel(
  db: FifoPrisma,
  tenantId: string,
  productId: string,
  unidadeDestinoId?: string,
  productSku?: string,
): Promise<number> {
  await prepararSaldoFifoParaOperacao(db, tenantId, productId, productSku);
  const where = await remessaSaldoItensWhere(
    db,
    tenantId,
    productId,
    productSku,
    unidadeDestinoId,
  );
  const rows = await db.nfeItem.findMany({
    where,
    select: { saldoDisponivel: true },
  });
  return rows.reduce((acc, r) => acc + (r.saldoDisponivel ?? 0), 0);
}

export type SaldoRemessaCdRow = {
  /** ID do catálogo de CDs (para dropdown da UI). */
  unidadeDestinoId: string;
  /** ID gravado na NF-e (`unidade_destino_id`) — usado no débito FIFO. */
  fifoUnidadeDestinoId: string;
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
  db: FifoPrisma,
  tenantId: string,
  productId: string,
  unidadeOrigemId: string,
  productSku: string | undefined,
  obterAtiva: (id: string) => Promise<{ id: string; codigo: string; uf: string; nome: string } | null>,
  obterAtivaPorCodigo: (codigo: string) => Promise<{ id: string; codigo: string; uf: string; nome: string } | null>,
): Promise<{ origem: { id: string; codigo: string; uf: string; nome: string }; fifoOrigemId: string } | null> {
  const saldos = await listarSaldoRemessaPorCd(db, tenantId, productId, productSku);

  const direta = await obterAtiva(unidadeOrigemId);
  const codigoDireto = direta?.codigo;
  let fifoOrigemId: string;
  try {
    fifoOrigemId = await resolveUnidadeFifoOrigemId(
      db,
      tenantId,
      productId,
      unidadeOrigemId,
      codigoDireto ??
        saldos.find(
          (s) =>
            s.unidadeDestinoId === unidadeOrigemId ||
            s.fifoUnidadeDestinoId === unidadeOrigemId,
        )?.unidade?.codigo ??
        "",
      productSku,
    );
  } catch (e) {
    if (e instanceof SaldoRemessaInsuficienteError) return null;
    throw e;
  }

  if (direta) {
    return { origem: direta, fifoOrigemId };
  }

  const saldoRow = saldos.find(
    (s) => s.fifoUnidadeDestinoId === fifoOrigemId || s.unidadeDestinoId === fifoOrigemId,
  );
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
  db: FifoPrisma,
  tenantId: string,
  productId: string,
  unidadeOrigemId: string,
  unidadeOrigemCodigo: string,
  productSku?: string,
): Promise<string> {
  const saldos = await listarSaldoRemessaPorCd(db, tenantId, productId, productSku);
  const direct = saldos.find((s) => s.unidadeDestinoId === unidadeOrigemId && s.saldo > 0);
  if (direct) return direct.fifoUnidadeDestinoId;

  const fifoDirect = saldos.find(
    (s) => s.fifoUnidadeDestinoId === unidadeOrigemId && s.saldo > 0,
  );
  if (fifoDirect) return fifoDirect.fifoUnidadeDestinoId;

  const codigo = unidadeOrigemCodigo.trim().toUpperCase();
  const byCodigo = saldos.find(
    (s) => s.unidade?.codigo?.trim().toUpperCase() === codigo && s.saldo > 0,
  );
  if (byCodigo) return byCodigo.fifoUnidadeDestinoId;

  const total = saldos.reduce((acc, s) => acc + s.saldo, 0);
  if (total <= 0) return unidadeOrigemId;

  throw new SaldoRemessaInsuficienteError(
    productId,
    1,
    saldos.find((s) => s.unidadeDestinoId === unidadeOrigemId)?.saldo ?? 0,
  );
}

/** Saldo líquido quando a nota ainda não tem linhas em `nfe_itens`. */
async function saldoLiquidoNotaSemItens(
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
async function garantirItensSaldoFifoNotas(
  prisma: FifoPrisma,
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
    const saldo = await saldoLiquidoNotaSemItens(prisma, nfe.id, nfe.quantidade);
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
async function reconciliarSaldoFifoItens(
  prisma: Pick<PrismaClient, "nfeItem" | "nfeRemessaConsumo">,
  tenantId: string,
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) return;

  const itens = await prisma.nfeItem.findMany({
    where: {
      tenantId,
      productId: productIds.length === 1 ? productIds[0]! : { in: productIds },
      nfe: remessaSaldoNfeWhere(tenantId),
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

async function prepararConsultaSaldoFifo(
  prisma: FifoPrisma,
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
export async function prepararSaldoFifoParaOperacao(
  prisma: FifoPrisma,
  tenantId: string,
  productId: string,
  productSku?: string,
): Promise<string | undefined> {
  const sku = await prepararConsultaSaldoFifo(prisma, tenantId, productId, productSku);
  const productIds = await collectRemessaSaldoProductIds(
    prisma,
    tenantId,
    productId,
    sku ?? productSku,
  );
  await garantirItensSaldoFifoNotas(prisma, tenantId, productIds);
  await reconciliarSaldoFifoItens(prisma, tenantId, productIds);
  return sku;
}

type NfeRemessaSaldoRow = {
  id: string;
  tipo: NFeTipo;
  quantidade: number;
  productId: string | null;
  itens: Array<{ productId: string }>;
};

/** Reconcilia FIFO e atualiza `itens` em memória antes de mapear NF-es para a UI. */
export async function atualizarItensSaldoFifoParaNfes(
  db: FifoPrisma,
  tenantId: string,
  nfes: NfeRemessaSaldoRow[],
): Promise<void> {
  const remessaIds: string[] = [];
  const productIds = new Set<string>();

  for (const nfe of nfes) {
    if (nfe.tipo !== NFeTipo.REMESSA && nfe.tipo !== NFeTipo.REMESSA_SIMBOLICA) continue;
    remessaIds.push(nfe.id);
    if (nfe.productId) productIds.add(nfe.productId);
    for (const item of nfe.itens) productIds.add(item.productId);
  }
  if (remessaIds.length === 0) return;

  for (const productId of productIds) {
    const cadastro = await db.product.findFirst({
      where: { tenantId, id: productId },
      select: { sku: true },
    });
    await prepararSaldoFifoParaOperacao(db, tenantId, productId, cadastro?.sku);
  }

  const refreshed = await db.nfeItem.findMany({
    where: { nfeId: { in: remessaIds } },
    include: { product: true },
    orderBy: [{ nfeId: "asc" }, { numeroItem: "asc" }],
  });

  const byNfeId = new Map<string, (typeof refreshed)[number][]>();
  for (const item of refreshed) {
    const bucket = byNfeId.get(item.nfeId) ?? [];
    bucket.push(item);
    byNfeId.set(item.nfeId, bucket);
  }

  for (const nfe of nfes) {
    if (nfe.tipo !== NFeTipo.REMESSA && nfe.tipo !== NFeTipo.REMESSA_SIMBOLICA) continue;
    (nfe as NfeRemessaSaldoRow & { itens: (typeof refreshed)[number][] }).itens =
      byNfeId.get(nfe.id) ?? [];
  }
}

/** Saldo exibido na listagem/detalhe de NF-e de remessa (soma itens ou quantidade − consumos). */
export async function saldoLiquidoRemessaNfe(
  db: Pick<PrismaTx, "nfeItem" | "nfeRemessaConsumo">,
  nfeId: string,
  quantidade: number,
): Promise<number> {
  const itens = await db.nfeItem.findMany({
    where: { nfeId },
    select: { saldoDisponivel: true },
  });
  if (itens.length > 0) {
    return itens.reduce((acc, item) => acc + (item.saldoDisponivel ?? 0), 0);
  }
  return saldoLiquidoNotaSemItens(db, nfeId, quantidade);
}

/** Saldo FIFO agregado por CD (unidade destino da remessa física ou simbólica). */
export async function listarSaldoRemessaPorCd(
  db: FifoPrisma,
  tenantId: string,
  productId: string,
  productSku?: string,
): Promise<SaldoRemessaCdRow[]> {
  const sku = await prepararSaldoFifoParaOperacao(db, tenantId, productId, productSku);

  const where = await remessaSaldoItensWhere(db, tenantId, productId, sku ?? productSku);
  const rows = await db.nfeItem.findMany({
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

  const catalogoPorCodigo = new Map<
    string,
    { id: string; codigo: string; nome: string; uf: string }
  >();
  const codigos = [
    ...new Set(
      rows
        .map((r) => r.nfe.unidadeDestino?.codigo?.trim().toUpperCase())
        .filter((c): c is string => Boolean(c)),
    ),
  ];
  if (codigos.length > 0) {
    const unidades = await db.meliUnidadeLogistica.findMany({
      where: { codigo: { in: codigos }, ativa: true },
      select: { id: true, codigo: true, nome: true, uf: true },
    });
    for (const u of unidades) {
      catalogoPorCodigo.set(u.codigo.toUpperCase(), u);
    }
  }

  const byCd = new Map<
    string,
    { saldo: number; fifoIds: Set<string>; unidade: SaldoRemessaCdRow["unidade"] }
  >();

  for (const row of rows) {
    const qty = row.saldoDisponivel ?? 0;
    if (qty <= 0) continue;

    const fifoId = row.nfe.unidadeDestinoId;

    const codigo = row.nfe.unidadeDestino?.codigo?.trim().toUpperCase() ?? "";
    const catalogo = codigo ? catalogoPorCodigo.get(codigo) : undefined;
    const chaveAgregacao = catalogo?.id ?? fifoId ?? `__sem_cd__${codigo || row.productId}`;
    const unidade = catalogo
      ? { codigo: catalogo.codigo, nome: catalogo.nome, uf: catalogo.uf }
      : (row.nfe.unidadeDestino ?? null);

    const prev = byCd.get(chaveAgregacao);
    const fifoIds = prev?.fifoIds ?? new Set<string>();
    if (fifoId) fifoIds.add(fifoId);
    byCd.set(chaveAgregacao, {
      saldo: (prev?.saldo ?? 0) + qty,
      fifoIds,
      unidade: unidade ?? prev?.unidade ?? null,
    });
  }

  return [...byCd.entries()]
    .map(([unidadeDestinoId, { saldo, fifoIds, unidade }]) => ({
      unidadeDestinoId,
      fifoUnidadeDestinoId: [...fifoIds][0] ?? unidadeDestinoId,
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

type FifoItemRow = {
  id: string;
  nfeId: string;
  saldoDisponivel: number | null;
  nfe?: {
    unidadeDestinoId: string | null;
    destUf?: string;
    tipo?: NFeTipo;
    unidadeDestino: { uf: string; codigo: string } | null;
  };
};

/** Resolve CD padrão do tenant para priorizar remessa física principal na venda. */
async function resolveDefaultCdContext(
  db: FifoPrisma,
  tenantId: string,
): Promise<DefaultCdContext> {
  const link = await db.tenantUnidadeLogistica.findFirst({
    where: { tenantId, padrao: true, unidade: { ativa: true } },
    select: {
      unidade: { select: { id: true, codigo: true } },
    },
  });
  if (!link?.unidade) return { unitId: null, codigo: null };
  return { unitId: link.unidade.id, codigo: link.unidade.codigo };
}

function toFifoVendaItem(row: FifoItemRow) {
  return {
    id: row.id,
    nfeId: row.nfeId,
    saldoDisponivel: row.saldoDisponivel,
    nfeTipo: row.nfe?.tipo,
    destUf: row.nfe?.destUf,
    unidadeUf: row.nfe?.unidadeDestino?.uf,
    unidadeDestinoId: row.nfe?.unidadeDestinoId,
    unidadeCodigo: row.nfe?.unidadeDestino?.codigo ?? null,
  };
}

function ordenarItensFifoVenda(
  itens: FifoItemRow[],
  buyerUf: string,
  defaultCd: DefaultCdContext,
): FifoItemRow[] {
  const byId = new Map(itens.map((item) => [item.id, item]));
  const sorted = ordenarFifoParaVenda(itens.map(toFifoVendaItem), buyerUf, defaultCd);
  return sorted.map((item) => byId.get(item.id)!);
}

async function listarItensRemessaFifo(
  tx: FifoPrisma,
  tenantId: string,
  productId: string,
  unidadeDestinoId?: string,
  productSku?: string,
  incluirUf = false,
): Promise<FifoItemRow[]> {
  const where = await remessaSaldoItensWhere(
    tx,
    tenantId,
    productId,
    productSku,
    unidadeDestinoId,
  );
  return tx.nfeItem.findMany({
    where,
    select: {
      id: true,
      nfeId: true,
      saldoDisponivel: true,
      ...(incluirUf
        ? {
            nfe: {
              select: {
                unidadeDestinoId: true,
                destUf: true,
                tipo: true,
                unidadeDestino: { select: { uf: true, codigo: true } },
              },
            },
          }
        : {}),
    },
    orderBy: [{ nfe: { emitidaEm: "asc" } }, { nfe: { numero: "asc" } }, { numeroItem: "asc" }],
  }) as unknown as Promise<FifoItemRow[]>;
}

async function debitarItensFifo(
  tx: Tx,
  itens: FifoItemRow[],
  quantidade: number,
  retornoNfeId: string | null,
  productId: string,
): Promise<{ remessaNfeId: string; quantidade: number; nfeItemId: string }[]> {
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
    if (retornoNfeId) {
      await tx.nfeRemessaConsumo.create({
        data: {
          retornoNfeId,
          remessaNfeId: item.nfeId,
          nfeItemId: item.id,
          quantidade: consumir,
        },
      });
    }
    alocacoes.push({ remessaNfeId: item.nfeId, quantidade: consumir, nfeItemId: item.id });
    restante -= consumir;
  }

  if (restante > 0) {
    const disponivel = quantidade - restante;
    throw new SaldoRemessaInsuficienteError(productId, quantidade, disponivel);
  }

  return alocacoes;
}

export async function consumirSaldoRemessaFifo(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantidade: number,
  retornoNfeId: string,
  unidadeDestinoId?: string,
): Promise<{ remessaNfeId: string; quantidade: number; nfeItemId: string }[]> {
  const fifoTx = tx as unknown as FifoPrisma;
  const itens = await listarItensRemessaFifo(fifoTx, tenantId, productId, unidadeDestinoId);
  return debitarItensFifo(tx, itens, quantidade, retornoNfeId, productId);
}

/**
 * Venda full: debita saldo com prioridade:
 * 1) UF do comprador; 2) avanço simbólico; 3) remessa física no CD padrão; 4) demais (FIFO).
 */
const REMESSA_DEST_SELECT = {
  id: true,
  chave: true,
  tipo: true,
  destNome: true,
  destDoc: true,
  destUf: true,
  destLogradouro: true,
  destNumero: true,
  destComplemento: true,
  destBairro: true,
  destCodigoMunicipio: true,
  destMunicipio: true,
  destCep: true,
  destCodigoPais: true,
  destNomePais: true,
  destTelefone: true,
  destIndIeDest: true,
  fiscalPayload: true,
  unidadeDestino: {
    select: {
      ie: true,
      idCadIntTran: true,
      codigoMunicipio: true,
      municipio: true,
      bairro: true,
      logradouro: true,
      numero: true,
      complemento: true,
      cep: true,
    },
  },
} as const;

export type PreviewRemessaFifoVenda = {
  remessaNfeId: string;
  remessaChave: string;
  destUf: string;
};

/**
 * Simula o FIFO da venda sem debitar saldo — usado para montar retorno com destino/CFOP corretos.
 */
export async function previewRemessaPrincipalFifoParaVenda(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantidade: number,
  destUf: string,
  productSku?: string,
): Promise<PreviewRemessaFifoVenda> {
  const fifoTx = tx as unknown as FifoPrisma;
  const sku = await prepararSaldoFifoParaOperacao(fifoTx, tenantId, productId, productSku);
  const defaultCd = await resolveDefaultCdContext(fifoTx, tenantId);
  const itens = await listarItensRemessaFifo(
    fifoTx,
    tenantId,
    productId,
    undefined,
    sku ?? productSku,
    true,
  );
  const ordenados = ordenarItensFifoVenda(itens, destUf, defaultCd);

  let restante = quantidade;
  let remessaNfeId: string | null = null;

  for (const item of ordenados) {
    if (restante <= 0) break;
    const saldo = item.saldoDisponivel ?? 0;
    if (saldo <= 0) continue;
    if (!remessaNfeId) remessaNfeId = item.nfeId;
    restante -= Math.min(restante, saldo);
  }

  if (restante > 0 || !remessaNfeId) {
    const disponivel = quantidade - restante;
    throw new SaldoRemessaInsuficienteError(productId, quantidade, disponivel);
  }

  const remessa = await tx.nFe.findUniqueOrThrow({
    where: { id: remessaNfeId },
    select: REMESSA_DEST_SELECT,
  });

  return {
    remessaNfeId: remessa.id,
    remessaChave: remessa.chave,
    destUf: remessa.destUf,
  };
}

export async function loadRemessaDestinoRetorno(tx: Tx, remessaNfeId: string) {
  return tx.nFe.findUniqueOrThrow({
    where: { id: remessaNfeId },
    select: REMESSA_DEST_SELECT,
  });
}

export async function consumirSaldoRemessaFifoParaVenda(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantidade: number,
  retornoNfeId: string,
  destUf: string,
  productSku?: string,
): Promise<{ remessaNfeId: string; quantidade: number; nfeItemId: string }[]> {
  const fifoTx = tx as unknown as FifoPrisma;
  const sku = await prepararSaldoFifoParaOperacao(fifoTx, tenantId, productId, productSku);
  const defaultCd = await resolveDefaultCdContext(fifoTx, tenantId);
  const itens = await listarItensRemessaFifo(
    fifoTx,
    tenantId,
    productId,
    undefined,
    sku ?? productSku,
    true,
  );
  const ordenados = ordenarItensFifoVenda(itens, destUf, defaultCd);
  return debitarItensFifo(tx, ordenados, quantidade, retornoNfeId, productId);
}

export async function debitarSaldoRemessaPorCd(
  tx: Tx,
  tenantId: string,
  productId: string,
  quantidade: number,
  unidadeDestinoId: string,
  productSku?: string,
): Promise<{ remessaNfeId: string; quantidade: number; nfeItemId: string }[]> {
  const fifoTx = tx as unknown as FifoPrisma;
  const itens = await listarItensRemessaFifo(
    fifoTx,
    tenantId,
    productId,
    unidadeDestinoId,
    productSku,
  );
  return debitarItensFifo(tx, itens, quantidade, null, productId);
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
