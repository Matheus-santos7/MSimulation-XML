import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

export class DeleteTaxRuleGroupUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string, baseId: string, origin: string) {
    return this.taxRuleRepository.deleteGroup(tenantId, baseId, origin);
  }
}
