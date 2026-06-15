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
  /** UF do emitente / estabelecimento responsável pela regra fiscal. */
  ufOrigem: string;
  ufDestino: string;
  /**
   * UF de saída física da mercadoria (CD fulfillment).
   * Quando informada, prevalece sobre `ufOrigem` no cálculo interestadual, DIFAL e CFOP.
   */
  ufSaidaFisica?: string;
  customerType: CustomerType;
  operationTipo?: FiscalOperationTipo;
  cstVendaReferencia?: CstVendaReferencia;
};
