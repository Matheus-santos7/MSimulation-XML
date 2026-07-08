import type { Tenant } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { runFiscalTransaction } from "../../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../../fiscal-documents/presentation/mappers/fiscal-mappers.js";
import { previewRemessaPrincipalFifoParaVenda } from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import type { SalesChainResult } from "../../application/dto/sales-chain.dto.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import type { SalesChainPort } from "../../domain/ports/sales-chain.port.js";
import { sliceOrderForEmitItem } from "../../domain/services/order-for-emit.helpers.js";
import {
  assertProductWithTaxRule,
  buildEmissionContext,
} from "../../domain/services/sales-chain.service.js";
import { consumeShipmentAndLinkReturn, emitReturnNote } from "./emit-return-note.js";
import { emitSaleNote } from "./emit-sale-note.js";
import { emitSaleCte } from "./cte-sale.adapter.js";
import { resolveSalesChainRules } from "./resolve-sales-chain-rules.js";
import type { ReturnNoteCreated } from "../../application/dto/sales-chain.dto.js";
import type { SalesChainRules } from "../../application/dto/sales-chain.dto.js";
import type { PreviewRemessaFifoVenda } from "../../../remessas/infrastructure/fifo/remessa-fifo.js";

/**
 * Orquestrador da **Cadeia de Vendas** (Sales Chain).
 *
 * Para pedidos multi-item, executa FIFO + retorno simbólico por linha e emite
 * uma única NF-e de VENDA com todos os `<det>`.
 */
export class SalesChainOrchestrator implements SalesChainPort {
  async emit(db: DbClient, order: OrderForEmit): Promise<SalesChainResult> {
    const ruleBaseId = assertProductWithTaxRule(order);
    const ctx = buildEmissionContext(order, ruleBaseId);

    return runFiscalTransaction(db, order.tenantId, async (tx) => {
      const returnNotes: ReturnNoteCreated[] = [];
      const allocations: unknown[] = [];
      let lastRules: SalesChainRules | null = null;
      let fifoPreview: PreviewRemessaFifoVenda | null = null;

      for (const item of order.items) {
        const itemOrder = sliceOrderForEmitItem(order, item);
        const itemRuleBaseId = item.product.taxRuleBaseId?.trim() ?? ruleBaseId;
        const preview = await previewRemessaPrincipalFifoParaVenda(
          tx,
          order.tenant.id,
          item.product.id,
          item.quantidade,
          order.destUf,
          item.product.sku,
        );
        fifoPreview = preview;
        const rules = await resolveSalesChainRules(
          tx,
          itemOrder,
          ctx,
          preview.destUf,
          itemRuleBaseId,
        );
        lastRules = rules;

        const returnNote = await emitReturnNote(tx, itemOrder, ctx, rules, preview);
        returnNotes.push(returnNote);
        const itemAllocations = await consumeShipmentAndLinkReturn(
          tx,
          itemOrder,
          returnNote,
          rules.emitterSettings,
        );
        allocations.push(...itemAllocations);
      }

      const primaryReturn = returnNotes[0]!;
      const saleRow = await emitSaleNote(
        tx,
        order,
        ctx,
        lastRules!,
        primaryReturn,
        fifoPreview!.destUf,
        fifoPreview!.destCodigoMunicipio,
      );
      const saleCte = await emitSaleCte(tx, order.tenant as Tenant, saleRow);

      const returnWithRef = await tx.nFe.findUniqueOrThrow({
        where: { id: primaryReturn.id },
        include: { nfeReferencia: { select: { chave: true, numero: true, serie: true } } },
      });

      return {
        venda: mapNfe(saleRow, primaryReturn.chave),
        retorno: mapNfe(returnWithRef, returnWithRef.nfeReferencia?.chave),
        cteVenda: saleCte,
        alocacoes: allocations,
      };
    });
  }
}

/** Fachada funcional legada para `emitSalesChain`. */
export async function emitSalesChain(db: DbClient, order: OrderForEmit) {
  return new SalesChainOrchestrator().emit(db, order);
}
