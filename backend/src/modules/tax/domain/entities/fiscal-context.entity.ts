import type { CustomerType } from "./tax-types.entity.js";

/** Tipo de operação fiscal (espelha `NFeTipo` sem acoplar o domínio ao Prisma). */
export type FiscalOperationTipo =
  | "VENDA"
  | "REMESSA"
  | "RETORNO_SIMBOLICO"
  | "DEVOLUCAO"
  | "REMESSA_SIMBOLICA";

/** CSTs da NF-e de venda referenciada (mapeamento de devolução). */
export type CstVendaReferencia = {
  icms?: string;
  pis?: string;
  cofins?: string;
};

/**
 * Contexto geográfico e de perfil do comprador para cálculo e resolução.
 *
 * Usado em `buildFiscalItem` e `resolveTaxRuleFromDb`.
 */
export type FiscalContext = {
  ufOrigem: string;
  ufDestino: string;
  customerType: CustomerType;
  operationTipo?: FiscalOperationTipo;
  cstVendaReferencia?: CstVendaReferencia;
};
