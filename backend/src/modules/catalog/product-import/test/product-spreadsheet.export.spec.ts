import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { Product } from "../../product/product.types.js";
import {
  buildProductSpreadsheetTemplateXlsx,
  buildProductSpreadsheetXlsx,
  EX_TIPI_FIELD_HELP,
} from "../spreadsheet/product-spreadsheet.export.js";
import { parseProductSpreadsheetXlsx } from "../spreadsheet/product-spreadsheet.parser.js";

const PRODUCT: Product = {
  id: "p-1",
  tenantId: "tenant-01",
  sku: "SKU-1",
  ean: "7897180513306",
  nome: "Fogão 4 Bocas",
  ncm: "73211100",
  exTipi: "01",
  nfci: "12345678-90AB-CDEF-1234-567890ABCDEF",
  origem: 0,
  unidade: "UNID",
  preco: 846,
  precoCusto: 520.5,
  estoque: 3,
  taxRuleBaseId: "Chuveiro",
};

describe("buildProductSpreadsheetXlsx", () => {
  it("should export rows that the importer reads back column by column", async () => {
    const file = await buildProductSpreadsheetXlsx([PRODUCT]);

    const { rows, errors } = await parseProductSpreadsheetXlsx(file);

    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sku: "SKU-1",
      ean: "7897180513306",
      ncm: "73211100",
      nfci: PRODUCT.nfci,
      unidade: "UNID",
      taxRuleBaseId: "Chuveiro",
    });
  });

  it("should put the field help as a note on the ex_tipi header", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(await buildProductSpreadsheetTemplateXlsx()).buffer);
    const header = workbook.getWorksheet("Produtos")!.getRow(1);

    const exTipi = [...Array(header.cellCount).keys()]
      .map((i) => header.getCell(i + 1))
      .find((cell) => cell.value === "ex_tipi")!;

    expect(exTipi.note).toBe(EX_TIPI_FIELD_HELP);
  });
});
