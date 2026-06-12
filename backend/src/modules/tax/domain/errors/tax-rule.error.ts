export class TaxRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxRuleError";
  }
}

/** @deprecated Use TaxRuleError — kept for backward compatibility. */
export class TaxRuleCatalogError extends TaxRuleError {
  constructor(message: string) {
    super(message);
    this.name = "TaxRuleCatalogError";
  }
}
