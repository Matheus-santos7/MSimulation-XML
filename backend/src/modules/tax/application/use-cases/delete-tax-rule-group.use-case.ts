import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

/**
 * Remove grupo de regras por `baseId` + UF origem (ação ADMIN).
 *
 * @param tenantId - Tenant emitente
 * @param baseId - Identificador base da regra (catálogo)
 * @param origin - UF origem do grupo
 */
export class DeleteTaxRuleGroupUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string, baseId: string, origin: string) {
    return this.taxRuleRepository.deleteGroup(tenantId, baseId, origin);
  }
}
