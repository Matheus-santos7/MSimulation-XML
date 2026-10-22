import { Inject, Injectable } from "@nestjs/common";
import { CatalogError } from "../../errors/catalog.errors.js";
import {
  parseProductSpreadsheetCsv,
  parseProductSpreadsheetXlsx,
} from "../spreadsheet/product-spreadsheet.parser.js";
import type { BulkUpsertProductsResult } from "../product-import.types.js";
import { BulkUpsertProductsUseCase } from "./bulk-upsert-products.usecase.js";

export type ImportProductsSpreadsheetResult = BulkUpsertProductsResult;

/**
 * Importa produtos a partir de planilha CSV ou XLSX.
 * Parse estrutural → validação fiscal e dedupe no bulk upsert.
 */
@Injectable()
export class ImportProductsSpreadsheetUseCase {
  constructor(
    @Inject(BulkUpsertProductsUseCase)
    private readonly bulkUpsertProducts: BulkUpsertProductsUseCase,
  ) {}

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
      throw new CatalogError.ProductInvalid(parsed.errors[0]?.message ?? "Planilha inválida");
    }

    if (parsed.rows.length === 0) {
      throw new CatalogError.ProductInvalid(
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
