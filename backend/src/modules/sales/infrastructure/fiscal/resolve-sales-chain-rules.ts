import { loadEmitterSettings } from "../../../../lib/fiscal/fiscal-emitter-runtime.js";
import { resolveTaxRule } from "../../../tax/index.js";
import type { EmissionContext } from "../../domain/entities/emission-context.entity.js";
import type { OrderForEmit } from "../../domain/entities/order-for-emit.entity.js";
import {
  requireTaxRule,
  resolveCustomerType,
} from "../../domain/services/sales-chain.service.js";
import type { SalesChainRules } from "../../application/dto/sales-chain.dto.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";

/**
 * Resolve regras fiscais de venda e inbound + settings do emissor para a cadeia.
 *
 * @param returnDestUf - UF do destino do retorno (CD da remessa FIFO)
 */
export async function resolveSalesChainRules(
  tx: PrismaTx,
  order: OrderForEmit,
  ctx: EmissionContext,
  returnDestUf: string,
): Promise<SalesChainRules> {
  const { tenant } = order;
  const emitterSettings = await loadEmitterSettings(tx, tenant.id);
  const customerType = resolveCustomerType(order.destIndIeDest);

  const saleTaxRule = requireTaxRule(
    await resolveTaxRule(tx, tenant.id, {
      originUf: tenant.uf,
      destinationUf: order.destUf,
      transactionType: "sale",
      customerType,
      ruleBaseId: ctx.ruleBaseId,
    }),
    {
      label: "venda",
      ruleBaseId: ctx.ruleBaseId,
      originUf: tenant.uf,
      destinationUf: order.destUf,
      customerType,
    },
  );

  const inboundTaxRule = requireTaxRule(
    await resolveTaxRule(tx, tenant.id, {
      originUf: tenant.uf,
      destinationUf: returnDestUf,
      transactionType: "inbound",
      customerType: "taxpayer",
      ruleBaseId: ctx.ruleBaseId,
    }),
    {
      label: "retorno simbólico",
      ruleBaseId: ctx.ruleBaseId,
      originUf: tenant.uf,
      destinationUf: returnDestUf,
    },
  );

  return { saleTaxRule, inboundTaxRule, customerType, emitterSettings };
}
