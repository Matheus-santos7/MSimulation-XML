/** Port for validating tax rules linked to a product. */
export interface TaxRuleValidatorPort {
  assertProductTaxRuleBaseId(
    tenantId: string,
    taxRuleBaseId: string,
    tenantUf: string,
  ): Promise<void>;
}
