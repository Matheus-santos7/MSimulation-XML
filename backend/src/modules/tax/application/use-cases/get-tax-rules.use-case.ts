import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

export class GetTaxRulesUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string) {
    return this.taxRuleRepository.listByTenant(tenantId);
  }
}
