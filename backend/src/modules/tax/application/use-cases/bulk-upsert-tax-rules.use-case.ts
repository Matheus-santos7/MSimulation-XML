import type { TaxRuleImportRow } from "../../domain/entities/tax-rule-import-row.entity.js";
import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

/**
 * Upsert em massa de regras já interpretadas (JSON/API).
 *
 * Para importação de planilha ML, use {@link ImportTaxRulesSpreadsheetUseCase}.
 *
 * @param tenantId - Tenant destino
 * @param rows - Linhas com `ruleId`, CFOP, payload `icmsByUf`
 * @returns Contadores created/updated/total
 */
export class BulkUpsertTaxRulesUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string, rows: TaxRuleImportRow[]) {
    return this.taxRuleRepository.bulkUpsert(tenantId, rows);
  }
}
