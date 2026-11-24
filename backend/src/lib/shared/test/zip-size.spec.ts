import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildXlsx } from "../../../test/xlsx-fixture.js";
import { validateSpreadsheetBuffer } from "../spreadsheet-upload.js";
import { sumZipUncompressedSize } from "../zip-size.js";

const MB = 1024 * 1024;
const FORGED_UNCOMPRESSED_BYTES = 200 * MB;
function buildRealXlsx(): Promise<Buffer> {
  return buildXlsx({
    Regras: [
      ["NCM", "CFOP"],
      ["1234", 5102],
    ],
  });
}

/** Total descompactado segundo o `unzip -l` (oráculo independente do parser do diretório central). */
function unzipListedTotal(zip: Buffer): number {
  const dir = mkdtempSync(join(tmpdir(), "zip-size-"));
  try {
    const file = join(dir, "planilha.xlsx");
    writeFileSync(file, zip);
    const lines = execFileSync("unzip", ["-l", file], { encoding: "utf8" }).trim().split("\n");

    return Number(lines.at(-1)!.trim().split(/\s+/)[0]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  it("soma os tamanhos descompactados de todas as entradas de um xlsx real", async () => {
    // Arrange
    const xlsx = await buildRealXlsx();
    const expected = unzipListedTotal(xlsx);

    // Act
    const total = sumZipUncompressedSize(xlsx);

    // Assert
    expect(expected).toBeGreaterThan(0);
    expect(total).toBe(expected);
  });

  it("lê o tamanho declarado no diretório central de um zip forjado", async () => {
    // Act
    const total = sumZipUncompressedSize(buildForgedZip(FORGED_UNCOMPRESSED_BYTES));

    // Assert
    expect(total).toBe(FORGED_UNCOMPRESSED_BYTES);
  });

  it("devolve null para buffer sem EOCD", async () => {
    // Act
    const total = sumZipUncompressedSize(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));

    // Assert
    expect(total).toBeNull();
  });

  it("devolve null para xlsx truncado", async () => {
    // Arrange
    const xlsx = await buildRealXlsx();

    // Act
    const total = sumZipUncompressedSize(xlsx.subarray(0, xlsx.length - 30));

    // Assert
    expect(total).toBeNull();
  });

  it("devolve null quando uma entrada usa o marcador zip64 (0xFFFFFFFF)", async () => {
    // Act
    const total = sumZipUncompressedSize(buildForgedZip(0xffffffff));

    // Assert
    expect(total).toBeNull();
  });
});

describe("validateSpreadsheetBuffer — tamanho descompactado", () => {
  it("aceita xlsx real pequeno", async () => {
    // Act
    const result = validateSpreadsheetBuffer(await buildRealXlsx(), { fileName: "regras.xlsx" });

    // Assert
    expect(result).toEqual({ ok: true });
  });

  it("recusa zip cujo diretório central declara 200 MB descompactados", async () => {
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

  it("recusa arquivo com cabeçalho ZIP mas estrutura inválida (falha fechada)", async () => {
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
