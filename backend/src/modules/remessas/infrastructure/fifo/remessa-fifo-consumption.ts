import {
  ordenarFifoParaVenda,
  type DefaultCdContext,
} from "../../domain/services/ordenar-fifo-venda.js";
import { REMESSA_DEST_SELECT } from "./remessa-fifo.constants.js";
import { SaldoRemessaInsuficienteError } from "./remessa-fifo.errors.js";
import { prepareRemessaFifoForOperation } from "./remessa-fifo-item-sync.js";
import { buildRemessaFifoItemsWhere } from "./remessa-fifo-product-ids.js";
import type {
  FifoItemRow,
  PreviewRemessaFifoVenda,
  RemessaFifoPrisma,
  RemessaFifoTx,
} from "./remessa-fifo.types.js";

/** Resolve CD padrão do tenant para priorizar remessa física principal na venda. */
async function resolveDefaultCdContext(
  db: RemessaFifoPrisma,
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

function sortRemessaFifoItemsForSale(
  itens: FifoItemRow[],
  buyerUf: string,
  defaultCd: DefaultCdContext,
): FifoItemRow[] {
  const byId = new Map(itens.map((item) => [item.id, item]));
  const sorted = ordenarFifoParaVenda(itens.map(toFifoVendaItem), buyerUf, defaultCd);
  return sorted.map((item) => byId.get(item.id)!);
}

async function listRemessaFifoItems(
  tx: RemessaFifoPrisma,
  tenantId: string,
  productId: string,
  unidadeDestinoId?: string,
  productSku?: string,
  incluirUf = false,
): Promise<FifoItemRow[]> {
  const where = await buildRemessaFifoItemsWhere(
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

async function debitRemessaFifoItems(
  tx: RemessaFifoTx,
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

export async function consumeRemessaFifoBalance(
  tx: RemessaFifoTx,
  tenantId: string,
  productId: string,
  quantidade: number,
  retornoNfeId: string,
  unidadeDestinoId?: string,
): Promise<{ remessaNfeId: string; quantidade: number; nfeItemId: string }[]> {
  const fifoTx = tx as unknown as RemessaFifoPrisma;
  const itens = await listRemessaFifoItems(fifoTx, tenantId, productId, unidadeDestinoId);
  return debitRemessaFifoItems(tx, itens, quantidade, retornoNfeId, productId);
}

/**
 * Simula o FIFO da venda sem debitar saldo — usado para montar retorno com destino/CFOP corretos.
 */
export async function previewRemessaPrincipalFifoParaVenda(
  tx: RemessaFifoTx,
  tenantId: string,
  productId: string,
  quantidade: number,
  destUf: string,
  productSku?: string,
): Promise<PreviewRemessaFifoVenda> {
  const fifoTx = tx as unknown as RemessaFifoPrisma;
  const sku = await prepareRemessaFifoForOperation(fifoTx, tenantId, productId, productSku);
  const defaultCd = await resolveDefaultCdContext(fifoTx, tenantId);
  const itens = await listRemessaFifoItems(
    fifoTx,
    tenantId,
    productId,
    undefined,
    sku ?? productSku,
    true,
  );
  const ordenados = sortRemessaFifoItemsForSale(itens, destUf, defaultCd);

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

export async function loadRemessaForReturnDestination(tx: RemessaFifoTx, remessaNfeId: string) {
  return tx.nFe.findUniqueOrThrow({
    where: { id: remessaNfeId },
    select: REMESSA_DEST_SELECT,
  });
}

/**
 * Venda full: debita saldo com prioridade:
 * 1) UF do comprador; 2) avanço simbólico; 3) remessa física no CD padrão; 4) demais (FIFO).
 */
export async function consumeRemessaFifoBalanceForSale(
  tx: RemessaFifoTx,
  tenantId: string,
  productId: string,
  quantidade: number,
  retornoNfeId: string,
  destUf: string,
  productSku?: string,
): Promise<{ remessaNfeId: string; quantidade: number; nfeItemId: string }[]> {
  const fifoTx = tx as unknown as RemessaFifoPrisma;
  const sku = await prepareRemessaFifoForOperation(fifoTx, tenantId, productId, productSku);
  const defaultCd = await resolveDefaultCdContext(fifoTx, tenantId);
  const itens = await listRemessaFifoItems(
    fifoTx,
    tenantId,
    productId,
    undefined,
    sku ?? productSku,
    true,
  );
  const ordenados = sortRemessaFifoItemsForSale(itens, destUf, defaultCd);
  return debitRemessaFifoItems(tx, ordenados, quantidade, retornoNfeId, productId);
}

export async function debitRemessaBalanceByCd(
  tx: RemessaFifoTx,
  tenantId: string,
  productId: string,
  quantidade: number,
  unidadeDestinoId: string,
  productSku?: string,
): Promise<{ remessaNfeId: string; quantidade: number; nfeItemId: string }[]> {
  const fifoTx = tx as unknown as RemessaFifoPrisma;
  const itens = await listRemessaFifoItems(
    fifoTx,
    tenantId,
    productId,
    unidadeDestinoId,
    productSku,
  );
  return debitRemessaFifoItems(tx, itens, quantidade, null, productId);
}

export async function reverseRemessaFifoConsumptions(
  tx: RemessaFifoTx,
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
