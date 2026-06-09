/**
 * Controle de saldo de remessas físicas (FIFO) por linha de NF-e (`nfe_itens`).
 */
import { NFeTipo, type Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { fiscalNotDeleted } from "./fiscal-service.js";

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

function remessaItemSaldoWhere(
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
