import type { ResolveTaxRuleParams, TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

export class ResolveTaxRuleUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string, params: ResolveTaxRuleParams, db?: unknown) {
    return this.taxRuleRepository.resolve(tenantId, params, db);
  }
}
