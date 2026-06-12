import { lineTotal } from "@msimulation-xml/fiscal-core";
import { gerarPedidoMl } from "../../../../lib/fiscal/nfe-chave.js";
import type { ResolvedTaxRule } from "../../../tax/domain/entities/resolved-tax-rule.entity.js";
import type { CustomerType } from "../../../tax/domain/entities/tax-types.entity.js";
import type { EmissionContext } from "../entities/emission-context.entity.js";
import type { OrderForEmit } from "../entities/order-for-emit.entity.js";
import { SalesChainError } from "../errors/sales-chain.error.js";

export function assertProductWithTaxRule(order: OrderForEmit): string {
  const ruleBaseId = order.product.taxRuleBaseId?.trim();
  if (!ruleBaseId) {
    const label = order.product.sku
      ? `${order.product.nome ?? "Produto"} (SKU ${order.product.sku})`
      : (order.product.nome ?? "Produto");
    throw new SalesChainError(
      `${label} sem regra fiscal associada. Edite o cadastro do produto e selecione a regra da planilha (necessário se as regras foram excluídas e reimportadas).`,
    );
  }
  return ruleBaseId;
}

export function buildEmissionContext(order: OrderForEmit, ruleBaseId: string): EmissionContext {
  const unitSalePrice = Number(order.product.preco);
  const unitCostPrice = Number(order.product.precoCusto);
  if (unitCostPrice <= 0) {
    throw new SalesChainError(
      "Preço de custo não informado ou zero. Informe o custo no cadastro do produto para emitir retorno simbólico.",
    );
  }
  const quantity = order.quantidade;
  return {
    serie: order.tenant.serieRemessa,
    pedidoMl: gerarPedidoMl(),
    emitidaEm: new Date(),
    valorUnitVenda: unitSalePrice,
    valorTotalVenda: lineTotal(unitSalePrice, quantity),
    valorUnitCusto: unitCostPrice,
    valorTotalCusto: lineTotal(unitCostPrice, quantity),
    ruleBaseId,
  };
}

export function saleDestinationAddress(order: OrderForEmit) {
  return {
    destNome: order.destNome,
    destDoc: order.destCpf,
    destUf: order.destUf,
    destLogradouro: order.destLogradouro,
    destNumero: order.destNumero,
    destComplemento: order.destComplemento,
    destBairro: order.destBairro,
    destCodigoMunicipio: order.destCodigoMunicipio,
    destMunicipio: order.destMunicipio,
    destCep: order.destCep,
    destCodigoPais: order.destCodigoPais,
    destNomePais: order.destNomePais,
    destTelefone: order.destTelefone?.replace(/\D/g, "") || "0000000000",
    destIndIeDest: order.destIndIeDest,
  };
}

export function requireTaxRule(
  rule: ResolvedTaxRule | null,
  ctx: {
    label: string;
    ruleBaseId: string;
    originUf: string;
    destinationUf: string;
    customerType?: CustomerType;
  },
): ResolvedTaxRule {
  if (rule) return rule;
  const profile =
    ctx.customerType === "non_taxpayer"
      ? " (não contribuinte)"
      : ctx.customerType === "taxpayer"
        ? " (contribuinte)"
        : "";
  throw new SalesChainError(
    `Regra fiscal "${ctx.ruleBaseId}" sem linha de ${ctx.label}${profile} para origem ${ctx.originUf} → destino ${ctx.destinationUf}. Confira a planilha importada.`,
  );
}

export function resolveCustomerType(destIndIeDest: number): CustomerType {
  return destIndIeDest === 9 ? "non_taxpayer" : "taxpayer";
}

export function inferIcmsRateForSale(emitUf: string, destUf: string): number {
  return emitUf.toUpperCase() === destUf.toUpperCase() ? 18 : 12;
}
