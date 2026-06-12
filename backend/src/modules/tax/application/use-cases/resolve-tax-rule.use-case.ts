import type { ResolveTaxRuleParams, TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

/**
 * Resolve regra fiscal para par origem×destino×transação×cliente.
 *
 * Usado por **sales**, **remessas** e **catalog** (via adapter).
 *
 * @param tenantId - Tenant emitente
 * @param params - Critérios de resolução incluindo `ruleBaseId` opcional
 * @param db - Cliente Prisma ou transação opcional
 * @returns {@link ResolvedTaxRule} ou `null`
 */
export class ResolveTaxRuleUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string, params: ResolveTaxRuleParams, db?: unknown) {
    return this.taxRuleRepository.resolve(tenantId, params, db);
  }
}
