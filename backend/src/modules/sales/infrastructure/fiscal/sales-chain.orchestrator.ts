import type { PrismaClient, Tenant } from "../../../../generated/prisma/client.js";
import { FISCAL_TRANSACTION_OPTIONS } from "../../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../../fiscal-documents/presentation/mappers/fiscal-mappers.js";
import { previewRemessaPrincipalFifoParaVenda } from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
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

/**
 * Orquestrador da **Cadeia de Vendas** (Sales Chain).
 *
 * Ponto único de emissão fiscal para checkout direto e faturamento de pedido.
 * Executa, dentro de `prisma.$transaction`:
 *
 * 1. Valida produto/regra fiscal e monta {@link EmissionContext}
 * 2. **FIFO** — `previewRemessaPrincipalFifoParaVenda` (remessa mais antiga com saldo)
 * 3. **Regras** — resolve CFOP/impostos venda + inbound (módulo tax)
 * 4. **RETORNO_SIMBOLICO** — referencia remessa FIFO; base de custo
 * 5. **Consumo FIFO** — debita `nfe_item.saldo_disponivel`; liga retorno ↔ remessa
 * 6. **VENDA** — NF-e ao comprador final; referencia retorno
 * 7. **CT-e** — transporte da venda (CD → consumidor)
 *
 * Rollback atómico em qualquer falha (`FISCAL_TRANSACTION_OPTIONS`).
 */
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

/** Fachada funcional legada para `emitSalesChain`. */
export async function emitSalesChain(prisma: PrismaClient, order: OrderForEmit) {
  return new SalesChainOrchestrator().emit(prisma, order);
}
