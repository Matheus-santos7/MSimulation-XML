import type { Tenant } from "../../generated/prisma/client.js";
import type { PrismaTx } from "../../lib/db/prisma-tx.js";
import type { FiscalEmitterSettingsData } from "../../lib/fiscal-emitter-settings-defaults.js";
import type { CustomerType, ResolvedTaxRule } from "../tax-rule-service.js";

/** Dados mínimos para emitir retorno + venda (checkout ou pedido faturado). */
export type PedidoForEmit = {
  tenantId: string;
  productId: string;
  quantidade: number;
  destCpf: string;
  destNome: string;
  destLogradouro: string;
  destNumero: string;
  destComplemento: string | null;
  destBairro: string;
  destCodigoMunicipio: string;
  destMunicipio: string;
  destUf: string;
  destCep: string;
  destCodigoPais: number;
  destNomePais: string;
  destTelefone: string | null;
  destIndIeDest: number;
  product: {
    id: string;
    ncm: string;
    preco: { toString(): string };
    precoCusto: { toString(): string };
    taxRuleBaseId: string | null;
    nome?: string;
    sku?: string;
    ean?: string | null;
    cest?: string;
    exTipi?: string | null;
    unidade?: string;
    origem?: number;
  };
  tenant: Tenant;
};

export class VendaChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VendaChainError";
  }
}

/** Alias de domínio: transação da emissão retorno + venda + CT-e. */
export type VendaChainTx = PrismaTx;

/** Contexto compartilhado entre retorno e venda na mesma emissão. */
export type ContextoEmissao = {
  serie: number;
  pedidoMl: string;
  emitidaEm: Date;
  valorUnitVenda: number;
  valorTotalVenda: number;
  valorUnitCusto: number;
  valorTotalCusto: number;
  ruleBaseId: string;
};

export type RegrasCadeiaVenda = {
  saleTaxRule: ResolvedTaxRule;
  inboundTaxRule: ResolvedTaxRule;
  customerType: CustomerType;
  emitterSettings: FiscalEmitterSettingsData;
};

export type NotaRetornoCriada = {
  id: string;
  chave: string;
};
