import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

/**
 * Lista catálogo agrupado (`baseId` + origem) para seleção em produtos.
 *
 * @param tenantId - Tenant emitente
 * @returns Entradas `{ baseId, nome, origin, label }`
 */
export class GetTaxRuleCatalogUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string) {
    return this.taxRuleRepository.listCatalogEntries(tenantId);
  }
}
