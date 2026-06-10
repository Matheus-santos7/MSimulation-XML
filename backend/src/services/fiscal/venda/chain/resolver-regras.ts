import { loadEmitterSettings } from "../../../../lib/fiscal/fiscal-emitter-runtime.js";
import { resolveTaxRule } from "../../tax/tax-rule-service.js";
import { requireTaxRule, resolveCustomerType } from "./context.js";
import type { ContextoEmissao, PedidoForEmit, RegrasCadeiaVenda, VendaChainTx } from "./types.js";

export async function resolverRegrasFiscais(
  tx: VendaChainTx,
  pedido: PedidoForEmit,
  ctx: ContextoEmissao,
  destUfRetorno: string,
): Promise<RegrasCadeiaVenda> {
  const { tenant } = pedido;
  const emitterSettings = await loadEmitterSettings(tx, tenant.id);
  const customerType = resolveCustomerType(pedido.destIndIeDest);

  const saleTaxRule = requireTaxRule(
    await resolveTaxRule(tx, tenant.id, {
      originUf: tenant.uf,
      destinationUf: pedido.destUf,
      transactionType: "sale",
      customerType,
      ruleBaseId: ctx.ruleBaseId,
    }),
    {
      label: "venda",
      ruleBaseId: ctx.ruleBaseId,
      originUf: tenant.uf,
      destinationUf: pedido.destUf,
      customerType,
    },
  );

  const inboundTaxRule = requireTaxRule(
    await resolveTaxRule(tx, tenant.id, {
      originUf: tenant.uf,
      destinationUf: destUfRetorno,
      transactionType: "inbound",
      customerType: "taxpayer",
      ruleBaseId: ctx.ruleBaseId,
    }),
    {
      label: "retorno simbólico",
      ruleBaseId: ctx.ruleBaseId,
      originUf: tenant.uf,
      destinationUf: destUfRetorno,
    },
  );

  return { saleTaxRule, inboundTaxRule, customerType, emitterSettings };
}
