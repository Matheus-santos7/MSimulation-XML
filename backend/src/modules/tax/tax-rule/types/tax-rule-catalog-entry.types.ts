/**
 * Entrada do catálogo de regras para dropdown de produtos (`taxRuleBaseId`).
 *
 * Agrupa linhas importadas pelo `baseId` + origem (UF emitente).
 */
export type TaxRuleCatalogEntry = {
  baseId: string;
  nome: string;
  origin: string;
  label: string;
};
