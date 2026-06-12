import { parseTaxRuleSpreadsheet } from "../../../../lib/fiscal/tax-rule-spreadsheet.parser.js";
import { TaxRuleError } from "../../domain/errors/tax-rule.error.js";
import type { TaxRuleRepository } from "../../domain/ports/tax-rule.repository.js";
import { mapTaxRuleSpreadsheetRows } from "../services/tax-rule-spreadsheet-mapper.js";

export type ImportTaxRulesSpreadsheetResult = {
  created: number;
  updated: number;
  total: number;
  parseErrors?: { line: number; message: string }[];
};

/**
 * Importa regras tributárias a partir da planilha ML (.xlsx).
 *
 * 1. Parse estrutural (aba, cabeçalho, células mescladas)
 * 2. Classificação tributária e montagem do payload JSON
 * 3. Persistência em massa
 */
export class ImportTaxRulesSpreadsheetUseCase {
  constructor(private readonly taxRuleRepository: TaxRuleRepository) {}

  async execute(tenantId: string, fileBuffer: Buffer): Promise<ImportTaxRulesSpreadsheetResult> {
    const parsed = parseTaxRuleSpreadsheet(fileBuffer);
    if (parsed.rawRows.length === 0) {
      throw new TaxRuleError(
        parsed.errors[0]?.message ?? "Nenhuma regra válida na planilha",
      );
    }

    const mapped = mapTaxRuleSpreadsheetRows(parsed.rawRows);
    const parseErrors = [...parsed.errors, ...mapped.errors];

    if (mapped.rows.length === 0) {
      throw new TaxRuleError(
        parseErrors[0]?.message ?? "Nenhuma regra válida após interpretação da planilha",
      );
    }

    const upsert = await this.taxRuleRepository.bulkUpsert(tenantId, mapped.rows);

    return {
      ...upsert,
      parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
    };
  }
}
