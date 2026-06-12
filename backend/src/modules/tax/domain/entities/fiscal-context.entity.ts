import type { CustomerType } from "./tax-types.entity.js";

/**
 * Contexto geográfico e de perfil do comprador para cálculo e resolução.
 *
 * Usado em `buildFiscalItem` e `resolveTaxRuleFromDb`.
 */
export type FiscalContext = {
  ufOrigem: string;
  ufDestino: string;
  customerType: CustomerType;
};
