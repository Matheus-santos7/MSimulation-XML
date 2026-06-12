import type { TaxRuleImportRow } from "../../domain/entities/tax-rule-import-row.entity.js";
import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

/**
 * Importação em massa de regras fiscais (planilha ML).
 *
 * @param tenantId - Tenant destino
 * @param rows - Linhas parseadas com `ruleId`, CFOP, payload `icmsByUf`
 * @returns Contadores created/updated/total
 */
export class BulkUpsertTaxRulesUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string, rows: TaxRuleImportRow[]) {
    return this.taxRuleRepository.bulkUpsert(tenantId, rows);
  }
}
