import { NFeTipo } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import {
  prepareRemessaFifoForOperation,
  getNetBalanceWithoutNfeItems,
} from "./remessa-fifo-item-sync.js";
import { buildRemessaFifoItemsWhere } from "./remessa-fifo-product-ids.js";
import type { NfeRemessaSaldoRow, RemessaFifoPrisma, RemessaCdBalanceRow } from "./remessa-fifo.types.js";

export async function getAvailableRemessaBalance(
  db: RemessaFifoPrisma,
  tenantId: string,
  productId: string,
  unidadeDestinoId?: string,
  productSku?: string,
): Promise<number> {
  await prepareRemessaFifoForOperation(db, tenantId, productId, productSku);
  const where = await buildRemessaFifoItemsWhere(
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

/** Reconcilia FIFO e atualiza `itens` em memória antes de mapear NF-es para a UI. */
export async function refreshRemessaFifoItemsForNfes(
  db: RemessaFifoPrisma,
  tenantId: string,
  nfes: NfeRemessaSaldoRow[],
): Promise<void> {
  const remessaIds: string[] = [];
  const productIds = new Set<string>();

  for (const nfe of nfes) {
    if (nfe.tipo !== NFeTipo.REMESSA && nfe.tipo !== NFeTipo.REMESSA_AVANCO) continue;
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
    await prepareRemessaFifoForOperation(db, tenantId, productId, cadastro?.sku);
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
    if (nfe.tipo !== NFeTipo.REMESSA && nfe.tipo !== NFeTipo.REMESSA_AVANCO) continue;
    (nfe as NfeRemessaSaldoRow & { itens: (typeof refreshed)[number][] }).itens =
      byNfeId.get(nfe.id) ?? [];
  }
}

/** Saldo exibido na listagem/detalhe de NF-e de remessa (soma itens ou quantidade − consumos). */
export async function getNetRemessaNfeBalance(
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
  return getNetBalanceWithoutNfeItems(db, nfeId, quantidade);
}

/** Saldo FIFO agregado por CD (unidade destino da remessa física ou simbólica). */
export async function listRemessaBalanceByCd(
  db: RemessaFifoPrisma,
  tenantId: string,
  productId: string,
  productSku?: string,
): Promise<RemessaCdBalanceRow[]> {
  const sku = await prepareRemessaFifoForOperation(db, tenantId, productId, productSku);

  const where = await buildRemessaFifoItemsWhere(db, tenantId, productId, sku ?? productSku);
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
    { saldo: number; fifoIds: Set<string>; unidade: RemessaCdBalanceRow["unidade"] }
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
