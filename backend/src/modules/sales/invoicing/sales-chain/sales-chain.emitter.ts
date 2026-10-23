import { Injectable } from "@nestjs/common";
import { getBillableMarketplaceProfile } from "@msimulation-xml/fiscal-core";
import type { Tenant } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { runFiscalTransaction } from "../../../../lib/db/prisma-tx.js";
import { mapNfe } from "../../../fiscal-documents/index.js";
import { previewRemessaPrincipalFifoParaVenda } from "../../../remessas/index.js";
import type { SalesChainResult } from "../types/sales-chain.types.js";
import type { OrderForEmit } from "../types/order-for-emit.types.js";
import { sumOrderFreteCte } from "../../order/rules/order-freight.validation.js";
import { sliceOrderForEmitItem } from "../rules/order-for-emit.helpers.js";
import { assertProductWithTaxRule, buildEmissionContext } from "../rules/sales-chain.rules.js";
import {
  consumeShipmentForReturn,
  emitConsolidatedReturnNote,
  persistConsolidatedReturnXml,
  type ReturnLinePrep,
} from "./return-note.emitter.js";
import { emitSaleNote } from "./sale-note.emitter.js";
import { emitSaleCte } from "./sale-cte.emitter.js";
import { resolveSalesChainRules } from "./sales-chain-rules.resolver.js";
import type { SalesChainRules } from "../types/sales-chain.types.js";
import type { PreviewRemessaFifoVenda } from "../../../remessas/index.js";

function sumOrderFreteCteFromOrder(order: OrderForEmit): number {
  return sumOrderFreteCte({
    freteConsumidor: order.valorFreteConsumidor ?? 0,
    freteSeller: order.valorFreteSeller ?? 0,
  });
}

/**
 * Cadeia de venda: RETORNO_SIMBOLICO com todos os `<det>`, consumo FIFO por linha, VENDA
 * consolidada e CT-e, numa transação.
 *
 * O marketplace do pedido define o perfil fiscal das notas, a configuração do faturador e de
 * quais remessas o FIFO consome. Marketplace sem perfil responde 422 antes de qualquer gravação.
 */
@Injectable()
export class SalesChainEmitter {
  /**
   * @throws {MarketplaceNotConfiguredError} Marketplace ainda sem perfil fiscal
   * @throws {SalesChainError} Regra fiscal, custo ou CFOP inválidos
   * @throws {SaldoRemessaInsuficienteError} Sem saldo de remessa no marketplace
   */
  async emit(db: DbClient, order: OrderForEmit): Promise<SalesChainResult> {
    const profile = getBillableMarketplaceProfile(order.marketplace);
    const ruleBaseId = assertProductWithTaxRule(order);
    const ctx = buildEmissionContext(order, ruleBaseId, profile);

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
          order.marketplace,
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

      const returnNote = await emitConsolidatedReturnNote(tx, order, ctx, returnLines, profile);

      for (const line of returnLines) {
        const itemAllocations = await consumeShipmentForReturn(tx, order, line.item, returnNote.id);
        allocations.push(...itemAllocations);
      }

      await persistConsolidatedReturnXml(tx, returnNote, order, lastRules!.emitterSettings);

      const saleRow = await emitSaleNote(
        tx,
        order,
        ctx,
        lastRules!,
        profile,
        returnNote,
        fifoPreview!.destUf,
        fifoPreview!.destCodigoMunicipio,
      );
      const saleCte = await emitSaleCte(
        tx,
        order.tenant as Tenant,
        saleRow,
        sumOrderFreteCteFromOrder(order),
      );

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
