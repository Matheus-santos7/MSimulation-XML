import type { PrismaClient, Tenant } from "../../../../generated/prisma/client.js";
import { FISCAL_TRANSACTION_OPTIONS } from "../../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../../../lib/fiscal/fiscal-mappers.js";
import { previewRemessaPrincipalFifoParaVenda } from "../../../../services/fiscal/remessa/remessa-fifo.js";
import type { SalesChainResult } from "../../application/dto/sales-chain.dto.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import type { SalesChainPort } from "../../domain/ports/sales-chain.port.js";
import {
  assertProductWithTaxRule,
  buildEmissionContext,
} from "../../domain/services/sales-chain.service.js";
import { consumeShipmentAndLinkReturn, emitReturnNote } from "./emit-return-note.js";
import { emitSaleNote } from "./emit-sale-note.js";
import { emitSaleCte } from "./cte-sale.adapter.js";
import { resolveSalesChainRules } from "./resolve-sales-chain-rules.js";

export class SalesChainOrchestrator implements SalesChainPort {
  async emit(prisma: PrismaClient, order: OrderForEmit): Promise<SalesChainResult> {
    const ruleBaseId = assertProductWithTaxRule(order);
    const ctx = buildEmissionContext(order, ruleBaseId);

    return prisma.$transaction(async (tx) => {
      const fifoPreview = await previewRemessaPrincipalFifoParaVenda(
        tx,
        order.tenant.id,
        order.product.id,
        order.quantidade,
        order.destUf,
        order.product.sku,
      );
      const rules = await resolveSalesChainRules(tx, order, ctx, fifoPreview.destUf);

      const returnNote = await emitReturnNote(tx, order, ctx, rules, fifoPreview);
      const allocations = await consumeShipmentAndLinkReturn(
        tx,
        order,
        returnNote,
        rules.emitterSettings,
      );

      const saleRow = await emitSaleNote(tx, order, ctx, rules, returnNote);
      const saleCte = await emitSaleCte(tx, order.tenant as Tenant, saleRow);

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
    }, FISCAL_TRANSACTION_OPTIONS);
  }
}

export async function emitSalesChain(prisma: PrismaClient, order: OrderForEmit) {
  return new SalesChainOrchestrator().emit(prisma, order);
}
