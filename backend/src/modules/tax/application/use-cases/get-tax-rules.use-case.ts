import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

/**
 * Lista todas as regras fiscais importadas do tenant (visão admin).
 *
 * @param tenantId - Tenant emitente
 */
export class GetTaxRulesUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string) {
    return this.taxRuleRepository.listByTenant(tenantId);
  }
}
