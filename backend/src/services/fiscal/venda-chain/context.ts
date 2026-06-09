import { lineTotal } from "@msimulation-xml/fiscal-core";
import type { Tenant } from "../../../generated/prisma/client.js";
import { gerarPedidoMl } from "../../../lib/nfe-chave.js";
import type { CustomerType, ResolvedTaxRule } from "../tax-rule-service.js";
import type { ContextoEmissao, PedidoForEmit } from "./types.js";
import { VendaChainError } from "./types.js";

export function assertProdutoComRegra(pedido: PedidoForEmit): string {
  const ruleBaseId = pedido.product.taxRuleBaseId?.trim();
  if (!ruleBaseId) {
    throw new VendaChainError(
      "Produto sem regra fiscal associada. Edite o cadastro do produto e selecione a regra da planilha.",
    );
  }
  return ruleBaseId;
}

export function buildContextoEmissao(pedido: PedidoForEmit, ruleBaseId: string): ContextoEmissao {
  const valorUnitVenda = Number(pedido.product.preco);
  const valorUnitCusto = Number(pedido.product.precoCusto);
  if (valorUnitCusto <= 0) {
    throw new VendaChainError(
      "Preço de custo não informado ou zero. Informe o custo no cadastro do produto para emitir retorno simbólico.",
    );
  }
  const q = pedido.quantidade;
  return {
    serie: pedido.tenant.serieRemessa,
    pedidoMl: gerarPedidoMl(),
    emitidaEm: new Date(),
    valorUnitVenda,
    valorTotalVenda: lineTotal(valorUnitVenda, q),
    valorUnitCusto,
    valorTotalCusto: lineTotal(valorUnitCusto, q),
    ruleBaseId,
  };
}

/** Destinatário do retorno = próprio emitente (entrada simbólica no full). */
export function enderecoDestRetorno(tenant: Tenant) {
  return {
    destNome: tenant.razaoSocial,
    destDoc: tenant.cnpj,
    destUf: tenant.uf,
    destLogradouro: tenant.logradouro,
    destNumero: tenant.numero,
    destComplemento: tenant.complemento,
    destBairro: tenant.bairro,
    destCodigoMunicipio: tenant.codigoMunicipio,
    destMunicipio: tenant.municipio,
    destCep: tenant.cep,
    destCodigoPais: tenant.codigoPais,
    destNomePais: tenant.nomePais,
    destTelefone: tenant.telefone?.replace(/\D/g, "") ?? null,
    destIndIeDest: 1,
  };
}

/** Destinatário da venda = comprador do pedido. */
export function enderecoDestVenda(pedido: PedidoForEmit) {
  return {
    destNome: pedido.destNome,
    destDoc: pedido.destCpf,
    destUf: pedido.destUf,
    destLogradouro: pedido.destLogradouro,
    destNumero: pedido.destNumero,
    destComplemento: pedido.destComplemento,
    destBairro: pedido.destBairro,
    destCodigoMunicipio: pedido.destCodigoMunicipio,
    destMunicipio: pedido.destMunicipio,
    destCep: pedido.destCep,
    destCodigoPais: pedido.destCodigoPais,
    destNomePais: pedido.destNomePais,
    destTelefone: pedido.destTelefone?.replace(/\D/g, "") || "0000000000",
    destIndIeDest: pedido.destIndIeDest,
  };
}

export function requireTaxRule(
  rule: ResolvedTaxRule | null,
  ctx: { label: string; ruleBaseId: string; originUf: string; destinationUf: string },
): ResolvedTaxRule {
  if (rule) return rule;
  throw new VendaChainError(
    `Regra fiscal "${ctx.ruleBaseId}" sem linha de ${ctx.label} para origem ${ctx.originUf} → destino ${ctx.destinationUf}. Confira a planilha importada.`,
  );
}

export function resolveCustomerType(destIndIeDest: number): CustomerType {
  return destIndIeDest === 9 ? "non_taxpayer" : "taxpayer";
}

export function inferAliqIcmsVenda(emitUf: string, destUf: string): number {
  return emitUf.toUpperCase() === destUf.toUpperCase() ? 18 : 12;
}
