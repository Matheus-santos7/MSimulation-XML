import { loadEmitterSettings } from "../../../fiscal-settings/index.js";
import { resolveTaxRule } from "../../../tax/index.js";
import type { EmissionContext } from "../types/emission-context.types.js";
import type { OrderForEmit } from "../types/order-for-emit.types.js";
import { requireTaxRule, resolveCustomerType } from "../rules/sales-chain.rules.js";
import type { SalesChainRules } from "../types/sales-chain.types.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";

/**
 * Resolve regras fiscais de venda e retorno simbólico + settings do emissor.
 *
 * Retorno: `transactionType: "symbolic_inbound_return"` (alias → `inbound` XLSX).
 *
 * @param returnDestUf - UF do destino do retorno (CD da remessa FIFO)
 */
export async function resolveSalesChainRules(
  tx: PrismaTx,
  order: OrderForEmit,
  ctx: EmissionContext,
  returnDestUf: string,
  ruleBaseId = ctx.ruleBaseId,
): Promise<SalesChainRules> {
  const { tenant } = order;
  const emitterSettings = await loadEmitterSettings(tx, tenant.id, order.marketplace);
  const customerType = resolveCustomerType(order.destIndIeDest);

  const saleTaxRule = requireTaxRule(
    await resolveTaxRule(tx, tenant.id, {
      originUf: tenant.uf,
      destinationUf: order.destUf,
      transactionType: "sale",
      customerType,
      ruleBaseId,
    }),
    {
      label: "venda",
      ruleBaseId,
      originUf: tenant.uf,
      destinationUf: order.destUf,
      customerType,
    },
  );

  // Impostos: `symbolic_inbound_return` com alias → `inbound` (XLSX legado).
  // CFOP do retorno continua na árvore (`sale-return-cfop`), não nesta TaxRule.
  const inboundTaxRule = requireTaxRule(
    await resolveTaxRule(tx, tenant.id, {
      originUf: tenant.uf,
      destinationUf: returnDestUf,
      transactionType: "symbolic_inbound_return",
      customerType: "taxpayer",
      ruleBaseId,
    }),
    {
      label: "retorno simbólico (symbolic_inbound_return)",
      ruleBaseId,
      originUf: tenant.uf,
      destinationUf: returnDestUf,
    },
  );

  return { saleTaxRule, inboundTaxRule, customerType, emitterSettings };
}
