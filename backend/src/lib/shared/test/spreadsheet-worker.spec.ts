import { describe, expect, it } from "vitest";
import { buildXlsx } from "../../../test/xlsx-fixture.js";
import { readSheetInWorker, readSheetOrError } from "../spreadsheet-worker.js";

describe("readSheetInWorker (P-8)", () => {
  it("should return the first sheet as a matrix, formatted or raw", async () => {
    const data = await buildXlsx({
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
    const data = await buildXlsx({ Capa: [["capa"]], " Regras Tributárias ": [["regra"]] });

    expect(
      await readSheetInWorker(data, { raw: false, sheetAliases: ["regras tributárias"] }),
    ).toEqual({ status: "ok", matrix: [["regra"]] });
    expect(await readSheetInWorker(data, { raw: false, sheetAliases: ["outra"] })).toEqual({
      status: "no-sheet",
    });
  });

  it("should refuse a sheet wider than maxColumns and cut rows with sheetRows", async () => {
    const data = await buildXlsx({
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
  it("should read merged cells only at the top-left cell, formulas by result", async () => {
    const data = await buildXlsx(
      {
        Aba: [
          ["Faixa", "", ""],
          ["a", "b", "c"],
        ],
      },
      (workbook) => {
        const sheet = workbook.getWorksheet("Aba")!;
        sheet.mergeCells("A1:C1");
        sheet.getCell("C2").value = { formula: "1+1", result: 2 };
      },
    );

    expect(await readSheetInWorker(data, { raw: false })).toEqual({
      status: "ok",
      matrix: [
        ["Faixa", "", ""],
        ["a", "b", "2"],
      ],
    });
  });
});
