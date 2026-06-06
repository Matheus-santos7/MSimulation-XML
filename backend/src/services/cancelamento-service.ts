/**
 * Cancelamento de NF-e (evento 110111) — venda e retorno simbólico da cadeia.
 *
 * Ao cancelar a VENDA:
 *  - registra evento 110111 na venda;
 *  - cancela automaticamente o RETORNO SIMBÓLICO referenciado (venda.nfeReferenciaId);
 *  - estorna o saldo FIFO consumido pelo retorno;
 *  - cancela o CT-e de venda vinculado, se existir.
 */

import { FiscalStatus, NFeTipo, type PrismaClient } from "../generated/prisma/client.js";
import type { PrismaTx } from "../lib/db/prisma-tx.js";
import { mapNfe } from "../lib/fiscal-mappers.js";
import { loadEmitterSettings } from "../lib/fiscal-emitter-runtime.js";
import { gerarProtocoloSefaz } from "../lib/sefaz-protocol.js";
import { fiscalNotDeleted } from "./fiscal-service.js";
import { estornarConsumosRemessa } from "./remessa-fifo.js";

const TP_EVENTO_CANCELAMENTO = "110111";

export class CancelamentoError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "CancelamentoError";
  }
}

async function registrarCancelamento(
  tx: PrismaTx,
  params: {
    tenantId: string;
    nfeId: string;
    xJust: string;
    ocorridoEm: Date;
  },
) {
  const existente = await tx.fiscalEvent.findFirst({
    where: { nfeId: params.nfeId, tipo: TP_EVENTO_CANCELAMENTO },
  });
  if (existente) {
    throw new CancelamentoError("NF-e já possui evento de cancelamento registrado.", 409);
  }

  await tx.fiscalEvent.create({
    data: {
      tenantId: params.tenantId,
      nfeId: params.nfeId,
      tipo: TP_EVENTO_CANCELAMENTO,
      descricao: "Cancelamento de NF-e",
      ocorridoEm: params.ocorridoEm,
      protocolo: gerarProtocoloSefaz(),
      xJust: params.xJust,
    },
  });

  await tx.nFe.update({
    where: { id: params.nfeId },
    data: { status: FiscalStatus.CANCELADA },
  });
}

function assertPrazoCancelamento(emitidaEm: Date, horas: number, naoInformar: boolean) {
  if (naoInformar) return;
  const limiteMs = horas * 60 * 60 * 1000;
  if (Date.now() - emitidaEm.getTime() > limiteMs) {
    throw new CancelamentoError(
      `Prazo de cancelamento expirado (${horas}h). Use devolução ou ajuste o prazo nas configurações fiscais.`,
      422,
    );
  }
}

/** Cancela venda e retorno simbólico referenciado. */
export async function cancelarVenda(
  prisma: PrismaClient,
  vendaChave: string,
  tenantId: string,
  xJust = "Cancelamento solicitado pelo emissor",
) {
  const venda = await prisma.nFe.findFirst({
    where: { chave: vendaChave, tenantId },
    include: {
      tenant: true,
      nfeReferencia: true,
      cteVenda: true,
    },
  });

  if (!venda || venda.deletedAt) {
    throw new CancelamentoError("NF-e de venda não encontrada.", 404);
  }
  if (venda.tipo !== NFeTipo.VENDA) {
    throw new CancelamentoError("Só é possível cancelar uma NF-e do tipo Venda.", 422);
  }
  if (venda.status === FiscalStatus.CANCELADA) {
    throw new CancelamentoError("Esta venda já está cancelada.", 409);
  }
  if (venda.status !== FiscalStatus.AUTORIZADA) {
    throw new CancelamentoError("Só NF-e autorizadas podem ser canceladas.", 422);
  }

  const devolucao = await prisma.nFe.findFirst({
    where: {
      tipo: NFeTipo.DEVOLUCAO,
      nfeReferenciaId: venda.id,
      ...fiscalNotDeleted,
    },
    select: { numero: true, serie: true },
  });
  if (devolucao) {
    throw new CancelamentoError(
      `Venda com devolução emitida (${devolucao.numero}/${devolucao.serie}). Cancele a devolução antes ou use outro fluxo.`,
      409,
    );
  }

  const settings = await loadEmitterSettings(prisma, venda.tenantId);
  assertPrazoCancelamento(
    venda.emitidaEm,
    settings.nfe.prazoCancelamento.horas,
    settings.nfe.prazoCancelamento.naoInformar,
  );

  const justificativa =
    xJust.trim().length >= 15 ? xJust.trim() : "Cancelamento solicitado pelo emissor conforme operacao";

  return prisma.$transaction(async (tx) => {
    const ocorridoEm = new Date();
    const retorno = venda.nfeReferencia;

    let saldoEstornado: { remessaNfeId: string; quantidade: number }[] = [];
    if (retorno && retorno.tipo === NFeTipo.RETORNO_SIMBOLICO && retorno.status !== FiscalStatus.CANCELADA) {
      saldoEstornado = await estornarConsumosRemessa(tx, retorno.id);
      await registrarCancelamento(tx, {
        tenantId: venda.tenantId,
        nfeId: retorno.id,
        xJust: justificativa,
        ocorridoEm,
      });
    }

    await registrarCancelamento(tx, {
      tenantId: venda.tenantId,
      nfeId: venda.id,
      xJust: justificativa,
      ocorridoEm,
    });

    if (venda.cteVenda && venda.cteVenda.status !== FiscalStatus.CANCELADA) {
      await tx.cTe.update({
        where: { id: venda.cteVenda.id },
        data: { status: FiscalStatus.CANCELADA },
      });
    }

    const vendaAtual = await tx.nFe.findUniqueOrThrow({
      where: { id: venda.id },
      include: { nfeReferencia: { select: { chave: true } } },
    });
    const retornoAtual = retorno
      ? await tx.nFe.findUnique({
          where: { id: retorno.id },
          include: { nfeReferencia: { select: { chave: true } } },
        })
      : null;

    return {
      venda: mapNfe(vendaAtual, vendaAtual.nfeReferencia?.chave),
      retorno: retornoAtual ? mapNfe(retornoAtual, retornoAtual.nfeReferencia?.chave) : undefined,
      saldoEstornado,
    };
  });
}
