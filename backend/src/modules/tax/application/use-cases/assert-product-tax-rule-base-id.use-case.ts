import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

export class AssertProductTaxRuleBaseIdUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string, taxRuleBaseId: string, tenantUf?: string) {
    return this.taxRuleRepository.assertProductBaseId(tenantId, taxRuleBaseId, tenantUf);
  }
}
