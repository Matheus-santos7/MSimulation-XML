import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { validateSpreadsheetBuffer } from "../spreadsheet-upload.js";
import { sumZipUncompressedSize } from "../zip-size.js";

const MB = 1024 * 1024;
const FORGED_UNCOMPRESSED_BYTES = 200 * MB;
/** Tipo "arquivo" no índice do `XLSX.CFB` (os demais são pastas/raiz). */
const CFB_FILE_TYPE = 2;

type CfbEntry = { type: number; name: string; content?: ArrayLike<number> };

function buildRealXlsx(): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["NCM", "CFOP"],
      ["1234", 5102],
    ]),
    "Regras",
  );

  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

/**
 * ZIP mínimo forjado: cabeçalho local "PK\x03\x04" + uma entrada no diretório central que
 * declara `uncompressedSize`, como faria um zip bomb dentro do teto de 15 MB do upload.
 */
function buildForgedZip(uncompressedSize: number): Buffer {
  const name = Buffer.from("xl/worksheets/sheet1.xml");
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  name.copy(local, 30);

  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt32LE(uncompressedSize, 24);
  central.writeUInt16LE(name.length, 28);
  name.copy(central, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length, 16);

  return Buffer.concat([local, central, eocd]);
}

describe("sumZipUncompressedSize", () => {
  it("soma os tamanhos descompactados de todas as entradas de um xlsx real", () => {
    // Arrange
    const xlsx = buildRealXlsx();
    // O CFB injeta uma entrada fantasma "Sh33tJ5" (4 bytes) que não existe no ZIP: fica de fora.
    const entries: CfbEntry[] = XLSX.CFB.read(xlsx, { type: "buffer" }).FileIndex;
    const expected = entries
      .filter((entry) => entry.type === CFB_FILE_TYPE && !entry.name.includes("Sh33tJ5"))
      .reduce((total, entry) => total + (entry.content?.length ?? 0), 0);

    // Act
    const total = sumZipUncompressedSize(xlsx);

    // Assert
    expect(expected).toBeGreaterThan(0);
    expect(total).toBe(expected);
  });

  it("lê o tamanho declarado no diretório central de um zip forjado", () => {
    // Act
    const total = sumZipUncompressedSize(buildForgedZip(FORGED_UNCOMPRESSED_BYTES));

    // Assert
    expect(total).toBe(FORGED_UNCOMPRESSED_BYTES);
  });

  it("devolve null para buffer sem EOCD", () => {
    // Act
    const total = sumZipUncompressedSize(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));

    // Assert
    expect(total).toBeNull();
  });

  it("devolve null para xlsx truncado", () => {
    // Arrange
    const xlsx = buildRealXlsx();

    // Act
    const total = sumZipUncompressedSize(xlsx.subarray(0, xlsx.length - 30));

    // Assert
    expect(total).toBeNull();
  });

  it("devolve null quando uma entrada usa o marcador zip64 (0xFFFFFFFF)", () => {
    // Act
    const total = sumZipUncompressedSize(buildForgedZip(0xffffffff));

    // Assert
    expect(total).toBeNull();
  });
});

describe("validateSpreadsheetBuffer — tamanho descompactado", () => {
  it("aceita xlsx real pequeno", () => {
    // Act
    const result = validateSpreadsheetBuffer(buildRealXlsx(), { fileName: "regras.xlsx" });

    // Assert
    expect(result).toEqual({ ok: true });
  });

  it("recusa zip cujo diretório central declara 200 MB descompactados", () => {
    // Act
    const result = validateSpreadsheetBuffer(buildForgedZip(FORGED_UNCOMPRESSED_BYTES), {
      fileName: "regras.xlsx",
    });

    // Assert
    expect(result).toEqual({
      ok: false,
      error: "Planilha descompactada excede o limite de 100 MB",
    });
  });

  it("recusa arquivo com cabeçalho ZIP mas estrutura inválida (falha fechada)", () => {
    // Act
    const result = validateSpreadsheetBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]), {
      fileName: "regras.xlsx",
    });

    // Assert
    expect(result).toEqual({
      ok: false,
      error: "Conteúdo inválido. O arquivo não parece ser uma planilha Excel (.xlsx)",
    });
  });
});
