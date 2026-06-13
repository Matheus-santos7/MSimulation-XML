import { lineTotal } from "@msimulation-xml/fiscal-core";
import { gerarPedidoMl } from "../../../fiscal-documents/domain/services/nfe-chave.js";
import type { ResolvedTaxRule } from "../../../tax/domain/entities/resolved-tax-rule.entity.js";
import type { CustomerType } from "../../../tax/domain/entities/tax-types.entity.js";
import { resolveIcmsFallbackRate } from "../../../tax/index.js";
import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";
import type { EmissionContext } from "../entities/emission-context.entity.js";
import type { OrderForEmit } from "../entities/order-for-emit.entity.js";
import { SalesChainError } from "../errors/sales-chain.error.js";

/**
 * Valida que o produto possui `taxRuleBaseId` antes de iniciar a cadeia fiscal.
 *
 * @param order - Snapshot de emissão com produto
 * @returns ID da regra base (trimmed)
 * @throws {SalesChainError} Produto sem regra fiscal associada
 */
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

/**
 * Monta o contexto numérico e identificadores da emissão (uma vez por operação).
 *
 * Calcula totais de venda e custo, gera `pedidoMl` e fixa série de remessa do tenant.
 *
 * @param order - Pedido/checkout a emitir
 * @param ruleBaseId - Regra fiscal validada
 * @returns {@link EmissionContext}
 * @throws {SalesChainError} `precoCusto` ausente ou zero
 */
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

/**
 * Extrai endereço e identificação do comprador final para a NF-e de VENDA.
 *
 * @param order - Snapshot com campos `dest*`
 * @returns Objeto normalizado para montagem do destinatário fiscal
 */
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

/**
 * Garante que a resolução de regra fiscal do módulo tax devolveu linha aplicável.
 *
 * @param rule - Regra resolvida ou `null`
 * @param ctx - Metadados para mensagem de erro (origem/destino, perfil do comprador)
 * @returns Regra válida
 * @throws {SalesChainError} Linha ausente na planilha importada
 */
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

/**
 * Deriva perfil do comprador a partir de `indIEDest` da NF-e.
 *
 * @param destIndIeDest - `9` = não contribuinte (consumidor final)
 */
export function resolveCustomerType(destIndIeDest: number): CustomerType {
  return destIndIeDest === 9 ? "non_taxpayer" : "taxpayer";
}

/**
 * Alíquota ICMS fallback intra vs interestadual quando a regra não especifica.
 *
 * @param emitUf - UF do emitente
 * @param destUf - UF do destinatário da venda
 */
export function inferIcmsRateForSale(
  emitUf: string,
  destUf: string,
  settings?: FiscalEmitterSettingsData | null,
): number {
  return resolveIcmsFallbackRate(emitUf, destUf, "sale", settings);
}
