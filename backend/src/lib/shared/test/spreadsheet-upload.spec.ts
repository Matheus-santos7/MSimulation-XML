import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { validateSpreadsheetBuffer } from "../spreadsheet-upload.js";

/** .xlsx real: além do cabeçalho ZIP, a validação lê o diretório central (teto descompactado). */
const XLSX_BYTES = Buffer.from(
  XLSX.write(
    { SheetNames: ["S"], Sheets: { S: XLSX.utils.aoa_to_sheet([["a"]]) } },
    { type: "buffer", bookType: "xlsx" },
  ),
);

describe("validateSpreadsheetBuffer", () => {
  it("recusa arquivo .xls com a mensagem que pede .xlsx", () => {
    // Act
    const result = validateSpreadsheetBuffer(XLSX_BYTES, { fileName: "regras.XLS" });

    // Assert
    expect(result).toEqual({ ok: false, error: "Formato inválido. Envie um arquivo .xlsx" });
  });

  it("aceita arquivo .xlsx com conteúdo ZIP", () => {
    // Act
    const result = validateSpreadsheetBuffer(XLSX_BYTES, { fileName: "regras.xlsx" });

    // Assert
    expect(result).toEqual({ ok: true });
  });
});
