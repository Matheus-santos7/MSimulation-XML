import {
  parseProductSpreadsheetCsv,
  parseProductSpreadsheetXlsx,
} from "../services/product-spreadsheet.parser.js";
import { ProductValidationError } from "../../domain/errors/product-validation.error.js";
import type { BulkUpsertProductsResult } from "../dto/bulk-upsert-products.command.js";
import type { BulkUpsertProductsUseCase } from "./bulk-upsert-products.use-case.js";

export type ImportProductsSpreadsheetResult = BulkUpsertProductsResult;

/**
 * Importa produtos a partir de planilha CSV ou XLSX.
 * Parse estrutural → validação fiscal e dedupe no bulk upsert.
 */
export class ImportProductsSpreadsheetUseCase {
  constructor(private readonly bulkUpsertProducts: BulkUpsertProductsUseCase) {}

  async execute(
    tenantId: string,
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<ImportProductsSpreadsheetResult> {
    const lower = fileName.toLowerCase();
    const isCsv = lower.endsWith(".csv");

    const parsed = isCsv
      ? parseProductSpreadsheetCsv(fileBuffer.toString("utf-8"))
      : parseProductSpreadsheetXlsx(fileBuffer);

    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      throw new ProductValidationError(parsed.errors[0]?.message ?? "Planilha inválida");
    }

    if (parsed.rows.length === 0) {
      throw new ProductValidationError(
        parsed.errors[0]?.message ?? "Nenhuma linha de dados na planilha",
      );
    }

    const result = await this.bulkUpsertProducts.execute({ tenantId, rows: parsed.rows });
    const parseErrors = [...parsed.errors, ...(result.parseErrors ?? [])];

    return {
      ...result,
      parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
    };
  }
}
