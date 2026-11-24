/** Monta .xlsx de teste com `exceljs`: uma aba por chave, na ordem do objeto. */
import ExcelJS from "exceljs";

export type FixtureCell = string | number | boolean | null;

export type FixtureSheets = Record<string, FixtureCell[][]>;

export async function buildXlsx(
  sheets: FixtureSheets,
  configure?: (workbook: ExcelJS.Workbook) => void,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(name);
    for (const row of rows) sheet.addRow(row);
  }
  configure?.(workbook);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
