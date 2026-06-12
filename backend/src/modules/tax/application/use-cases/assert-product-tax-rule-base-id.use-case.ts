import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

/**
 * Valida vínculo produto ↔ regra fiscal antes de persistir catálogo ou emitir venda.
 *
 * @param tenantId - Tenant emitente
 * @param taxRuleBaseId - ID base da regra (dropdown de produtos)
 * @param tenantUf - UF do emitente para validação regional
 * @throws {TaxRuleError} Regra inexistente ou incompatível
 */
export class AssertProductTaxRuleBaseIdUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string, taxRuleBaseId: string, tenantUf?: string) {
    return this.taxRuleRepository.assertProductBaseId(tenantId, taxRuleBaseId, tenantUf);
  }
}
