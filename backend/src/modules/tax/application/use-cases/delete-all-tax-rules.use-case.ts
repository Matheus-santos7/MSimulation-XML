import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

export class DeleteAllTaxRulesUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string) {
    return this.taxRuleRepository.deleteAll(tenantId);
  }
}
