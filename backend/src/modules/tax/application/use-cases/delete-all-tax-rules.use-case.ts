import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

/**
 * Remove todas as regras fiscais do tenant (ação ADMIN).
 *
 * @param tenantId - Tenant emitente
 * @returns `{ deleted: number }`
 */
export class DeleteAllTaxRulesUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string) {
    return this.taxRuleRepository.deleteAll(tenantId);
  }
}
