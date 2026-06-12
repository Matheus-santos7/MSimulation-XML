/**
 * NF-e cancellation (event 110111) — sale and symbolic return in the fulfillment chain.
 *
 * When cancelling a SALE:
 *  - registers event 110111 on the sale;
 *  - automatically cancels the referenced SYMBOLIC RETURN (sale.nfeReferenciaId);
 *  - reverses FIFO balance consumed by the return;
 *  - cancels the linked sale CT-e, if present.
 */

import { FiscalStatus, NFeTipo, type PrismaClient } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../../../lib/fiscal/fiscal-mappers.js";
import { loadEmitterSettings } from "../../../../lib/fiscal/fiscal-emitter-runtime.js";
import { gerarProtocoloSefaz } from "../../../../lib/fiscal/sefaz-protocol.js";
import { fiscalNotDeleted } from "../../../../services/fiscal/shared/fiscal-service.js";
import { estornarConsumosRemessa } from "../../../../services/fiscal/remessa/remessa-fifo.js";
import type { CancelDocumentResult } from "../../domain/entities/lifecycle-result.entity.js";
import { DocumentCancellationError } from "../../domain/errors/document-cancellation.error.js";
import type {
  CancelDocumentInput,
  DocumentCancellationPort,
} from "../../domain/ports/fiscal-document-lifecycle.port.js";

const CANCELLATION_EVENT_TYPE = "110111";

export class PrismaDocumentCancellationRepository implements DocumentCancellationPort {
  constructor(private readonly prisma: PrismaClient) {}

  async cancelSale(input: CancelDocumentInput): Promise<CancelDocumentResult> {
    const { tenantId, nfeKey, justification } = input;

    const sale = await this.prisma.nFe.findFirst({
      where: { chave: nfeKey, tenantId },
      include: {
        tenant: true,
        nfeReferencia: true,
        cteVenda: true,
      },
    });

    if (!sale || sale.deletedAt) {
      throw new DocumentCancellationError("NF-e de venda não encontrada.", 404);
    }
    if (sale.tipo !== NFeTipo.VENDA) {
      throw new DocumentCancellationError("Só é possível cancelar uma NF-e do tipo Venda.", 422);
    }
    if (sale.status === FiscalStatus.CANCELADA) {
      throw new DocumentCancellationError("Esta venda já está cancelada.", 409);
    }
    if (sale.status !== FiscalStatus.AUTORIZADA) {
      throw new DocumentCancellationError("Só NF-e autorizadas podem ser canceladas.", 422);
    }

    const existingReturn = await this.prisma.nFe.findFirst({
      where: {
        tipo: NFeTipo.DEVOLUCAO,
        nfeReferenciaId: sale.id,
        ...fiscalNotDeleted,
      },
      select: { numero: true, serie: true },
    });
    if (existingReturn) {
      throw new DocumentCancellationError(
        `Venda com devolução emitida (${existingReturn.numero}/${existingReturn.serie}). Cancele a devolução antes ou use outro fluxo.`,
        409,
      );
    }

    const settings = await loadEmitterSettings(this.prisma, sale.tenantId);
    assertCancellationDeadline(
      sale.emitidaEm,
      settings.nfe.prazoCancelamento.horas,
      settings.nfe.prazoCancelamento.naoInformar,
    );

    const normalizedJustification =
      (justification?.trim().length ?? 0) >= 15
        ? justification!.trim()
        : "Cancelamento solicitado pelo emissor conforme operacao";

    return this.prisma.$transaction(async (tx) => {
      const occurredAt = new Date();
      const symbolicReturn = sale.nfeReferencia;

      let reversedBalance: CancelDocumentResult["saldoEstornado"] = [];
      if (
        symbolicReturn &&
        symbolicReturn.tipo === NFeTipo.RETORNO_SIMBOLICO &&
        symbolicReturn.status !== FiscalStatus.CANCELADA
      ) {
        reversedBalance = await estornarConsumosRemessa(tx, symbolicReturn.id);
        await registerCancellation(tx, {
          tenantId: sale.tenantId,
          nfeId: symbolicReturn.id,
          justification: normalizedJustification,
          occurredAt,
        });
      }

      await registerCancellation(tx, {
        tenantId: sale.tenantId,
        nfeId: sale.id,
        justification: normalizedJustification,
        occurredAt,
      });

      if (sale.cteVenda && sale.cteVenda.status !== FiscalStatus.CANCELADA) {
        await tx.cTe.update({
          where: { id: sale.cteVenda.id },
          data: { status: FiscalStatus.CANCELADA },
        });
      }

      const updatedSale = await tx.nFe.findUniqueOrThrow({
        where: { id: sale.id },
        include: { nfeReferencia: { select: { chave: true } } },
      });
      const updatedReturn = symbolicReturn
        ? await tx.nFe.findUnique({
            where: { id: symbolicReturn.id },
            include: { nfeReferencia: { select: { chave: true } } },
          })
        : null;

      return {
        venda: mapNfe(updatedSale, updatedSale.nfeReferencia?.chave) as Record<string, unknown>,
        retorno: updatedReturn
          ? (mapNfe(updatedReturn, updatedReturn.nfeReferencia?.chave) as Record<string, unknown>)
          : undefined,
        saldoEstornado: reversedBalance,
      };
    });
  }
}

async function registerCancellation(
  tx: PrismaTx,
  params: {
    tenantId: string;
    nfeId: string;
    justification: string;
    occurredAt: Date;
  },
) {
  const existing = await tx.fiscalEvent.findFirst({
    where: { nfeId: params.nfeId, tipo: CANCELLATION_EVENT_TYPE },
  });
  if (existing) {
    throw new DocumentCancellationError("NF-e já possui evento de cancelamento registrado.", 409);
  }

  await tx.fiscalEvent.create({
    data: {
      tenantId: params.tenantId,
      nfeId: params.nfeId,
      tipo: CANCELLATION_EVENT_TYPE,
      descricao: "Cancelamento de NF-e",
      ocorridoEm: params.occurredAt,
      protocolo: gerarProtocoloSefaz(),
      xJust: params.justification,
    },
  });

  await tx.nFe.update({
    where: { id: params.nfeId },
    data: { status: FiscalStatus.CANCELADA },
  });
}

function assertCancellationDeadline(issuedAt: Date, hours: number, skipDeadline: boolean) {
  if (skipDeadline) return;
  const limitMs = hours * 60 * 60 * 1000;
  if (Date.now() - issuedAt.getTime() > limitMs) {
    throw new DocumentCancellationError(
      `Prazo de cancelamento expirado (${hours}h). Use devolução ou ajuste o prazo nas configurações fiscais.`,
      422,
    );
  }
}
