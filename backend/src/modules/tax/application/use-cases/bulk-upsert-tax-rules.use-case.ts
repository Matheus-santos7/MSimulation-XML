import type { TaxRuleImportRow } from "../../domain/entities/tax-rule-import-row.entity.js";
import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";

export class BulkUpsertTaxRulesUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  execute(tenantId: string, rows: TaxRuleImportRow[]) {
    return this.taxRuleRepository.bulkUpsert(tenantId, rows);
  }
}
