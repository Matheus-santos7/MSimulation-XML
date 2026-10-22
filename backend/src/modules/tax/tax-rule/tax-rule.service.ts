import { Inject, Injectable } from "@nestjs/common";
import { TaxRuleError } from "../errors/tax.errors.js";
import { mapTaxRuleSpreadsheetRows } from "./spreadsheet/tax-rule-spreadsheet.mapper.js";
import { parseTaxRuleSpreadsheet } from "./spreadsheet/tax-rule-spreadsheet.parser.js";
import { TaxRuleRepository } from "./tax-rule.repository.js";
import type { TaxRuleImportRow } from "./types/tax-rule-import-row.types.js";

export type ImportTaxRulesSpreadsheetResult = {
  created: number;
  updated: number;
  total: number;
  parseErrors?: { line: number; message: string }[];
};

/** Regras tributárias do tenant: consulta, catálogo para produtos, importação e exclusão. */
@Injectable()
export class TaxRuleService {
  constructor(@Inject(TaxRuleRepository) private readonly taxRuleRepository: TaxRuleRepository) {}

  list(tenantId: string) {
    return this.taxRuleRepository.listByTenant(tenantId);
  }

  /** Catálogo agrupado (`baseId` + origem) para o seletor de regra no produto. */
  catalog(tenantId: string) {
    return this.taxRuleRepository.listCatalogEntries(tenantId);
  }

  /** Upsert em massa de linhas já interpretadas (JSON). */
  bulkUpsert(tenantId: string, rows: TaxRuleImportRow[]) {
    return this.taxRuleRepository.bulkUpsert(tenantId, rows);
  }

  /**
   * Importa a planilha de regras (.xlsx): parse estrutural, classificação tributária e upsert.
   * @throws {TaxRuleError} Planilha sem nenhuma regra válida
   */
  async importSpreadsheet(
    tenantId: string,
    fileBuffer: Buffer,
  ): Promise<ImportTaxRulesSpreadsheetResult> {
    const parsed = parseTaxRuleSpreadsheet(fileBuffer);
    if (parsed.rawRows.length === 0) {
      throw new TaxRuleError(parsed.errors[0]?.message ?? "Nenhuma regra válida na planilha");
    }

    const mapped = mapTaxRuleSpreadsheetRows(parsed.rawRows);
    const parseErrors = [...parsed.errors, ...mapped.errors];
    if (mapped.rows.length === 0) {
      throw new TaxRuleError(
        parseErrors[0]?.message ?? "Nenhuma regra válida após interpretação da planilha",
      );
    }

    const upsert = await this.taxRuleRepository.bulkUpsert(tenantId, mapped.rows);

    return { ...upsert, parseErrors: parseErrors.length > 0 ? parseErrors : undefined };
  }

  deleteAll(tenantId: string) {
    return this.taxRuleRepository.deleteAll(tenantId);
  }

  /**
   * Valida o vínculo produto ↔ regra (existe no tenant e vale para a UF do emitente).
   * @throws {TaxRuleError} Regra inexistente ou incompatível
   */
  assertProductTaxRuleBaseId(tenantId: string, taxRuleBaseId: string, tenantUf?: string) {
    return this.taxRuleRepository.assertProductBaseId(tenantId, taxRuleBaseId, tenantUf);
  }
}
