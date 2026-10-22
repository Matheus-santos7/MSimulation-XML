/**
 * Erro de validação ou estado inválido de regra fiscal. Erro de domínio: cada rota decide o status
 * (400 no import e na exclusão de regras; o catalog responde 400 ao vincular produto).
 *
 * Ex.: `taxRuleBaseId` inexistente no tenant ou incompatível com UF do emitente.
 */
export class TaxRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxRuleError";
  }
}

/**
 * Alias legado para integrações catalog/sales (`TaxRuleCatalogError`).
 * @deprecated Preferir {@link TaxRuleError}
 */
export class TaxRuleCatalogError extends TaxRuleError {
  constructor(message: string) {
    super(message);
    this.name = "TaxRuleCatalogError";
  }
}
