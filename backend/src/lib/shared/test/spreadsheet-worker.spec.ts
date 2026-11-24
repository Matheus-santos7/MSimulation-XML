import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readSheetInWorker, readSheetOrError } from "../spreadsheet-worker.js";

function workbook(sheets: Record<string, (string | number)[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("readSheetInWorker (P-8)", () => {
  it("should return the first sheet as a matrix, formatted or raw", async () => {
    const data = workbook({
      Primeira: [
        ["sku", "preco"],
        ["A1", 10.5],
      ],
      Outra: [["x"]],
    });

    expect(await readSheetInWorker(data, { raw: false })).toEqual({
      status: "ok",
      matrix: [
        ["sku", "preco"],
        ["A1", "10.5"],
      ],
    });
    expect(await readSheetInWorker(data, { raw: true })).toEqual({
      status: "ok",
      matrix: [
        ["sku", "preco"],
        ["A1", 10.5],
      ],
    });
  });

  it("should pick the sheet by alias, ignoring case and surrounding spaces", async () => {
    const data = workbook({ Capa: [["capa"]], " Regras Tributárias ": [["regra"]] });

    expect(
      await readSheetInWorker(data, { raw: false, sheetAliases: ["regras tributárias"] }),
    ).toEqual({ status: "ok", matrix: [["regra"]] });
    expect(await readSheetInWorker(data, { raw: false, sheetAliases: ["outra"] })).toEqual({
      status: "no-sheet",
    });
  });

  it("should refuse a sheet wider than maxColumns and cut rows with sheetRows", async () => {
    const data = workbook({
      Aba: [
        ["a", "b", "c"],
        ["1", "2", "3"],
        ["4", "5", "6"],
      ],
    });

    expect(await readSheetInWorker(data, { raw: false, maxColumns: 2 })).toEqual({
      status: "too-many-columns",
    });
    expect(await readSheetInWorker(data, { raw: false, sheetRows: 2 })).toEqual({
      status: "ok",
      matrix: [
        ["a", "b", "c"],
        ["1", "2", "3"],
      ],
    });
  });

  it("should turn an unreadable file into a user message instead of throwing", async () => {
    const corrupt = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 7)]);

    expect(await readSheetOrError(corrupt, { raw: false })).toEqual({
      status: "unreadable",
      message: "Não foi possível ler a planilha",
    });
  });
});
