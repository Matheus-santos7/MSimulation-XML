import { beforeAll, describe, expect, it } from "vitest";
import { buildXlsx } from "../../../test/xlsx-fixture.js";
import { validateSpreadsheetBuffer } from "../spreadsheet-upload.js";

/** .xlsx real: além do cabeçalho ZIP, a validação lê o diretório central (teto descompactado). */
let XLSX_BYTES: Buffer;

beforeAll(async () => {
  XLSX_BYTES = await buildXlsx({ S: [["a"]] });
});

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
