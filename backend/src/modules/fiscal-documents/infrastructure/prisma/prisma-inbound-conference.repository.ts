/**
 * Conferência INBOUND — orquestra saldo lógico, deltas e emissão POSITIVE/NEGATIVE.
 * 1ª fatia: remessa mono-produto (header productId).
 */

import {
  assertPedidoMlForConference,
  computeConferenceDeltas,
  InboundConferenceCfopError,
  InboundConferenceDeltaError,
} from "@msimulation-xml/fiscal-core";
import { NFeTipo } from "../../../../generated/prisma/client.js";
import { runFiscalTransaction } from "../../../../lib/db/prisma-tx.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { DocumentReturnError } from "../../domain/errors/document-return.error.js";
import { num } from "../../presentation/mappers/fiscal-mappers.js";
import { loadEmitterSettings } from "../../../fiscal-settings/application/services/fiscal-emitter-runtime.js";
import { prepareRemessaFifoForOperation } from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import { loadLogicalConferenceBalance } from "./inbound-conference-balance.js";
import {
  emitNegativeDifference,
  emitPositiveDifference,
} from "./inbound-conference-emit.js";

export type ProcessInboundConferenceInput = {
  tenantId: string;
  remessaNfeKey: string;
  /** Quantidade contada agora (expected = saldo lógico atual). */
  receivedQty: number;
  positiveCfopOverride?: string | null;
  negativeCfopOverride?: string | null;
};

export type ProcessInboundConferenceResult = {
  expectedQty: number;
  receivedQty: number;
  negative?: Record<string, unknown>;
  positive?: Record<string, unknown>;
  saldoApos: number;
  noop: boolean;
};

export type ConferenceExpectedResult = {
  expectedQty: number;
  parentBalance: number;
  positiveChildrenQty: number;
  pedidoMl: string | null;
};

export class PrismaInboundConferenceRepository {
  private get db() {
    return getDbClient();
  }

  private async loadRemessa(tenantId: string, remessaNfeKey: string) {
    const remessa = await this.db.nFe.findFirst({
      where: { chave: remessaNfeKey, tenantId },
      include: { tenant: true, product: true },
    });

    if (!remessa || remessa.deletedAt) {
      throw new DocumentReturnError("NF-e de remessa não encontrada.", 404);
    }
    if (remessa.tipo !== NFeTipo.REMESSA && remessa.tipo !== NFeTipo.REMESSA_AVANCO) {
      throw new DocumentReturnError(
        "Conferência só se aplica a remessa ou remessa avanço.",
        422,
      );
    }
    if (!remessa.product) {
      throw new DocumentReturnError("Remessa sem produto vinculado.", 422);
    }
    return remessa;
  }

  async getExpectedQty(input: {
    tenantId: string;
    remessaNfeKey: string;
  }): Promise<ConferenceExpectedResult> {
    const remessa = await this.loadRemessa(input.tenantId, input.remessaNfeKey);
    const product = remessa.product!;

    return runFiscalTransaction(this.db, input.tenantId, async (tx) => {
      await prepareRemessaFifoForOperation(
        tx as unknown as Parameters<typeof prepareRemessaFifoForOperation>[0],
        remessa.tenant.id,
        product.id,
        product.sku ?? undefined,
      );
      const balance = await loadLogicalConferenceBalance(tx, {
        tenantId: remessa.tenant.id,
        remessaId: remessa.id,
        remessaQuantidade: remessa.quantidade,
      });
      return {
        expectedQty: balance.expectedQty,
        parentBalance: balance.parentBalance,
        positiveChildrenQty: balance.expectedQty - balance.parentBalance,
        pedidoMl: remessa.pedidoMl,
      };
    });
  }

  async processConference(
    input: ProcessInboundConferenceInput,
  ): Promise<ProcessInboundConferenceResult> {
    const { tenantId, remessaNfeKey, receivedQty } = input;
    const remessa = await this.loadRemessa(tenantId, remessaNfeKey);

    try {
      assertPedidoMlForConference(remessa.pedidoMl);
    } catch (error) {
      throw new DocumentReturnError(
        error instanceof Error ? error.message : "pedidoMl obrigatório.",
        422,
      );
    }

    const tenant = remessa.tenant;
    const product = remessa.product!;
    const destUf = remessa.destUf;
    const unitValue =
      remessa.quantidade > 0 ? num(remessa.valor) / remessa.quantidade : num(remessa.valor);

    return runFiscalTransaction(this.db, tenantId, async (tx) => {
      await prepareRemessaFifoForOperation(
        tx as unknown as Parameters<typeof prepareRemessaFifoForOperation>[0],
        tenant.id,
        product.id,
        product.sku ?? undefined,
      );

      const balance = await loadLogicalConferenceBalance(tx, {
        tenantId: tenant.id,
        remessaId: remessa.id,
        remessaQuantidade: remessa.quantidade,
      });
      const { expectedQty, parentBalance, positiveChildren } = balance;

      let plan;
      try {
        plan = computeConferenceDeltas([
          { lineId: remessa.id, expectedQty, receivedQty },
        ]);
      } catch (error) {
        if (
          error instanceof InboundConferenceDeltaError ||
          error instanceof InboundConferenceCfopError
        ) {
          throw new DocumentReturnError(error.message, 422);
        }
        throw error;
      }

      if (!plan.hasDifferences) {
        return {
          expectedQty,
          receivedQty,
          saldoApos: expectedQty,
          noop: true,
        };
      }

      const emitterSettings = await loadEmitterSettings(tx, tenant.id);
      const series = tenant.serieRemessa;
      const shared = {
        tx,
        tenant,
        product,
        remessa,
        destUf,
        unitValue,
        emitterSettings,
        series,
      };

      let negativeDto: Record<string, unknown> | undefined;
      let positiveDto: Record<string, unknown> | undefined;

      const neg = plan.negative[0];
      if (neg) {
        negativeDto = await emitNegativeDifference(shared, {
          quantity: neg.absDelta,
          parentBalance,
          positiveChildren,
          negativeCfopOverride: input.negativeCfopOverride,
        });
      }

      const pos = plan.positive[0];
      if (pos) {
        positiveDto = await emitPositiveDifference(shared, {
          quantity: pos.absDelta,
          positiveCfopOverride: input.positiveCfopOverride,
        });
      }

      const after = await loadLogicalConferenceBalance(tx, {
        tenantId: tenant.id,
        remessaId: remessa.id,
        remessaQuantidade: remessa.quantidade,
      });

      await tx.nFe.update({
        where: { id: remessa.id },
        data: { saldoDisponivel: after.parentBalance },
      });

      return {
        expectedQty,
        receivedQty,
        negative: negativeDto,
        positive: positiveDto,
        saldoApos: after.expectedQty,
        noop: false,
      };
    });
  }
}
