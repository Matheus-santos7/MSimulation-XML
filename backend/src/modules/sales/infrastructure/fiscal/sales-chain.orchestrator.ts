import type { Tenant } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { runFiscalTransaction } from "../../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../../fiscal-documents/presentation/mappers/fiscal-mappers.js";
import { previewRemessaPrincipalFifoParaVenda } from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import type { SalesChainResult } from "../../application/dto/sales-chain.dto.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import { sumOrderFreteCte } from "../../domain/services/order-freight.validation.js";
import type { SalesChainPort } from "../../domain/ports/sales-chain.port.js";
import { sliceOrderForEmitItem } from "../../domain/services/order-for-emit.helpers.js";
import {
  assertProductWithTaxRule,
  buildEmissionContext,
} from "../../domain/services/sales-chain.service.js";
import {
  consumeShipmentForReturn,
  emitConsolidatedReturnNote,
  persistConsolidatedReturnXml,
  type ReturnLinePrep,
} from "./emit-return-note.js";
import { emitSaleNote } from "./emit-sale-note.js";
import { emitSaleCte } from "./cte-sale.adapter.js";
import { resolveSalesChainRules } from "./resolve-sales-chain-rules.js";
import type { SalesChainRules } from "../../application/dto/sales-chain.dto.js";
import type { PreviewRemessaFifoVenda } from "../../../remessas/infrastructure/fifo/remessa-fifo.js";

function sumOrderFreteCteFromOrder(order: OrderForEmit): number {
  return sumOrderFreteCte({
    freteConsumidor: order.valorFreteConsumidor ?? 0,
    freteSeller: order.valorFreteSeller ?? 0,
  });
}

/**
 * Orquestrador da **Cadeia de Vendas** (Sales Chain).
 *
 * Para pedidos multi-item: uma NF-e de RETORNO_SIMBOLICO com todos os `<det>`,
 * consumo FIFO por linha e uma NF-e de VENDA consolidada.
 */
export class SalesChainOrchestrator implements SalesChainPort {
  async emit(db: DbClient, order: OrderForEmit): Promise<SalesChainResult> {
    const ruleBaseId = assertProductWithTaxRule(order);
    const ctx = buildEmissionContext(order, ruleBaseId);

    return runFiscalTransaction(db, order.tenantId, async (tx) => {
      const allocations: unknown[] = [];
      let lastRules: SalesChainRules | null = null;
      let fifoPreview: PreviewRemessaFifoVenda | null = null;
      const returnLines: ReturnLinePrep[] = [];

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
        returnLines.push({ item, preview, rules });
      }

      const returnNote = await emitConsolidatedReturnNote(tx, order, ctx, returnLines);

      for (const line of returnLines) {
        const itemAllocations = await consumeShipmentForReturn(
          tx,
          order,
          line.item,
          returnNote.id,
        );
        allocations.push(...itemAllocations);
      }

      await persistConsolidatedReturnXml(tx, returnNote, order, lastRules!.emitterSettings);

      const saleRow = await emitSaleNote(
        tx,
        order,
        ctx,
        lastRules!,
        returnNote,
        fifoPreview!.destUf,
        fifoPreview!.destCodigoMunicipio,
      );
      const saleCte = await emitSaleCte(tx, order.tenant as Tenant, saleRow, sumOrderFreteCteFromOrder(order));

      const returnWithRef = await tx.nFe.findUniqueOrThrow({
        where: { id: returnNote.id },
        include: { nfeReferencia: { select: { chave: true, numero: true, serie: true } } },
      });

      return {
        venda: mapNfe(saleRow, returnNote.chave),
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
