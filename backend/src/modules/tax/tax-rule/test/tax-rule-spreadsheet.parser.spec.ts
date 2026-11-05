import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import * as XLSX from "xlsx";
import { mapTaxRuleSpreadsheetRows } from "../spreadsheet/tax-rule-spreadsheet.mapper.js";
import {
  MAX_TAX_RULE_SHEET_COLUMNS,
  MAX_TAX_RULE_SHEET_ROWS,
  parseTaxRuleSpreadsheet,
} from "../spreadsheet/tax-rule-spreadsheet.parser.js";

function buildWorkbookBuffer(dataRows: (string | number)[][]): Buffer {
  const rows = [HEADER_KEYS.map(() => ""), HEADER_KEYS, HEADER_LABELS, ...dataRows];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Regras tributárias");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

const HEADER_KEYS = [
  "RULE_ID",
  "RULE_NAME",
  "ORIGIN",
  "TRANSACTION_TYPE",
  "IPI_ST",
  "IPI_ALIQUOTA",
];
const HEADER_LABELS = [
  "RULE_ID",
  "Nome da regra",
  "Origem Fiscal",
  "Tipo de destinatário:",
  "Situação Tributária do IPI",
  "Alíquota de IPI (%)",
];

describe("parseTaxRuleSpreadsheet", () => {
  it("mantém ruleId numérico quando RULE_NAME é rótulo descritivo", () => {
    const buffer = buildWorkbookBuffer([
      ["612610", "4133250001", "SP", "Contribuinte", "99", 0],
      ["612610", "Item nacional", "RJ", "Não contribuinte", "99", 0],
      ["612610", "Item nacional", "RJ", "Envio de estoque (Transferência ou Remessa)", "99", 0],
    ]);

    const { rawRows, errors } = parseTaxRuleSpreadsheet(buffer);
    assert.equal(errors.length, 0);
    assert.equal(rawRows.length, 3);

    assert.deepEqual(
      rawRows.map((row) => ({
        ruleId: row.ruleId,
        ruleName: row.ruleName,
        origin: row.origin,
        transactionTypeLabel: row.transactionTypeLabel,
      })),
      [
        {
          ruleId: "4133250001",
          ruleName: "4133250001",
          origin: "SP",
          transactionTypeLabel: "Contribuinte",
        },
        {
          ruleId: "4133250001",
          ruleName: "4133250001",
          origin: "SP",
          transactionTypeLabel: "Não contribuinte",
        },
        {
          ruleId: "4133250001",
          ruleName: "4133250001",
          origin: "SP",
          transactionTypeLabel: "Envio de estoque (Transferência ou Remessa)",
        },
      ],
    );
  });

  it("inicia novo grupo quando RULE_NAME numérico aparece em linha seguinte", () => {
    const buffer = buildWorkbookBuffer([
      ["612610", "4133250001", "SP", "Contribuinte", "99", 0],
      ["", "4133250002", "SP", "Contribuinte", "99", 0],
      ["", "", "RJ", "Não contribuinte", "99", 0],
    ]);

    const { rawRows } = parseTaxRuleSpreadsheet(buffer);
    assert.equal(rawRows[0]!.ruleId, "4133250001");
    assert.equal(rawRows[1]!.ruleId, "4133250002");
    assert.equal(rawRows[2]!.ruleId, "4133250002");
    assert.equal(rawRows[2]!.origin, "SP");
  });

  it("usa RULE_ID numérico e RULE_NAME descritivo no formato ML novo", () => {
    const buffer = buildWorkbookBuffer([
      ["355076", "Chuveiro", "SP", "Contribuinte (consumo)", "50", 0],
      ["355076", "Chuveiro 8516100001 – Nacional", "SP", "Não contribuinte", "50", 0],
      [
        "355076",
        "Chuveiro 8516100001 – Nacional",
        "SP",
        "Envio de estoque (Transferência ou Remessa)",
        "50",
        0,
      ],
      ["355072", "Pressurizador 84137080 – Importado", "SP ", "Contribuinte (consumo)", "50", 3.25],
    ]);

    const { rawRows, errors } = parseTaxRuleSpreadsheet(buffer);
    assert.equal(errors.length, 0);
    assert.equal(rawRows.length, 4);

    assert.deepEqual(
      rawRows.map((row) => ({
        ruleId: row.ruleId,
        ruleName: row.ruleName,
        origin: row.origin,
      })),
      [
        { ruleId: "355076", ruleName: "Chuveiro", origin: "SP" },
        { ruleId: "355076", ruleName: "Chuveiro", origin: "SP" },
        { ruleId: "355076", ruleName: "Chuveiro", origin: "SP" },
        { ruleId: "355072", ruleName: "Pressurizador 84137080 – Importado", origin: "SP" },
      ],
    );
  });

  it("preserva nome alfanumérico e misto sem forçar ruleName = ruleId", () => {
    const buffer = buildWorkbookBuffer([
      ["9001", "Nacional-Fogões 123", "SP", "Contribuinte", "99", 0],
      ["9001", "Nacional-Fogões 123 C/Grill", "SP", "Não contribuinte", "99", 0],
      ["9002", "8516100001-Nacional", "SP", "Contribuinte", "99", 0],
    ]);

    const { rawRows, errors } = parseTaxRuleSpreadsheet(buffer);
    assert.equal(errors.length, 0);

    assert.equal(rawRows[0]!.ruleId, "9001");
    assert.equal(rawRows[0]!.ruleName, "Nacional-Fogões 123");
    assert.equal(rawRows[1]!.ruleName, "Nacional-Fogões 123");
    assert.equal(rawRows[2]!.ruleId, "9002");
    assert.equal(rawRows[2]!.ruleName, "8516100001-Nacional");
  });

  it("abre grupo novo quando RULE_ID vem vazio e RULE_NAME segue o padrão '<código> - <sufixo>'", () => {
    // Caso real (planilha ML 23-10): só o 1º grupo traz RULE_ID; os demais ("X - IMPORTADO") vêm
    // sem ele. Antes todos caíam no grupo do 1º e se sobrescreviam (183 de 468 linhas perdidas).
    const buffer = buildWorkbookBuffer([
      ["40021110", "40021110", "SP", "Contribuinte (consumo)", "99", 0],
      ["", "", "SP", "Não contribuinte", "99", 0],
      ["", "39259090 - IMPORTADO", "SP", "Contribuinte (consumo)", "99", 0],
      ["", "", "SP", "Não contribuinte", "99", 0],
      ["", "82055900 - IMPORTADO", "SP", "Contribuinte (consumo)", "99", 0],
    ]);

    const { rawRows, errors } = parseTaxRuleSpreadsheet(buffer);
    const mapped = mapTaxRuleSpreadsheetRows(rawRows);

    assert.equal(errors.length, 0);
    assert.deepEqual(
      rawRows.map((row) => row.ruleId),
      ["40021110", "40021110", "39259090 - IMPORTADO", "39259090 - IMPORTADO", "82055900 - IMPORTADO"],
    );
    assert.equal(mapped.errors.length, 0);
    assert.equal(mapped.rows.length, 5);
  });

  it("não abre grupo para rótulo de continuação sem o padrão '<código> - <sufixo>'", () => {
    const buffer = buildWorkbookBuffer([
      ["40021110", "40021110", "SP", "Contribuinte (consumo)", "99", 0],
      ["", "40021110 (consumo)", "SP", "Não contribuinte", "99", 0],
    ]);

    const { rawRows } = parseTaxRuleSpreadsheet(buffer);

    assert.deepEqual(
      rawRows.map((row) => row.ruleId),
      ["40021110", "40021110"],
    );
  });

  it("aceita RULE_NAME puramente numérico igual ao RULE_ID", () => {
    const buffer = buildWorkbookBuffer([
      ["4133250001", "4133250001", "SP", "Contribuinte", "99", 0],
      ["4133250001", "4133250001", "SP", "Não contribuinte", "99", 0],
    ]);

    const { rawRows, errors } = parseTaxRuleSpreadsheet(buffer);
    assert.equal(errors.length, 0);
    assert.equal(rawRows[0]!.ruleId, "4133250001");
    assert.equal(rawRows[0]!.ruleName, "4133250001");
  });
});

function buildCustomWorkbook(keys: string[], dataRows: (string | number)[][]): Buffer {
  const rows = [keys.map(() => ""), keys, keys, ...dataRows];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Regras tributárias");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("conversão numérica por coluna", () => {
  const keys = [
    "RULE_ID",
    "RULE_NAME",
    "ORIGIN",
    "TRANSACTION_TYPE",
    "IBS_CBS_CCLASSTRIB",
    "IPI_COD_ENQ",
    "IPI_ALIQUOTA",
    "ICMS_SP_PICMS_INTERNAL",
    "ICMS_SP_COD_BENEF",
  ];
  const parseCells = (...values: string[]) =>
    parseTaxRuleSpreadsheet(
      buildCustomWorkbook(keys, [["01234567", "Regra", "SP", "Contribuinte", ...values]]),
    ).rawRows[0]!;

  it("mantém códigos fiscais como texto, com zeros à esquerda", () => {
    const row = parseCells("000001", "001", "0", "18", "SP020120");
    assert.equal(row.cells.IBS_CBS_CCLASSTRIB, "000001");
    assert.equal(row.cells.IPI_COD_ENQ, "001");
    assert.equal(row.ruleId, "01234567");
  });

  it("converte decimais pt-BR e ponto decimal em colunas numéricas", () => {
    assert.equal(parseCells("a", "b", "12,5", "1.234,56", "").cells.IPI_ALIQUOTA, 12.5);
    assert.equal(parseCells("a", "b", "1.234,56", "12.5", "").cells.ICMS_SP_PICMS_INTERNAL, 12.5);
    assert.equal(parseCells("a", "b", "12.5", "0.00", "").cells.IPI_ALIQUOTA, 12.5);
    assert.equal(parseCells("a", "b", "1.234,56", "0.00", "").cells.IPI_ALIQUOTA, 1234.56);
  });

  it("trata ponto com grupo de 3 dígitos como milhar", () => {
    assert.equal(parseCells("a", "b", "1.250", "0", "").cells.IPI_ALIQUOTA, 1250);
  });

  it("mantém texto não numérico em coluna numérica", () => {
    assert.equal(
      parseCells("a", "b", "Não aplicável", "0", "").cells.IPI_ALIQUOTA,
      "Não aplicável",
    );
  });
});

describe("limite de linhas", () => {
  const dataRow = (i: number) => [`R${i}`, `R${i}`, "SP", "Contribuinte", "99", 0];

  it("rejeita planilha acima do limite", () => {
    const rows = Array.from({ length: MAX_TAX_RULE_SHEET_ROWS + 1 }, (_, i) => dataRow(i));
    const result = parseTaxRuleSpreadsheet(buildWorkbookBuffer(rows));
    assert.deepEqual(result, {
      rawRows: [],
      errors: [{ line: 1, message: `Planilha excede ${MAX_TAX_RULE_SHEET_ROWS} linhas` }],
    });
  });

  it("aceita planilha exatamente no limite", () => {
    const rows = Array.from({ length: MAX_TAX_RULE_SHEET_ROWS }, (_, i) => dataRow(i));
    const result = parseTaxRuleSpreadsheet(buildWorkbookBuffer(rows));
    assert.equal(result.errors.length, 0);
    assert.equal(result.rawRows.length, MAX_TAX_RULE_SHEET_ROWS);
  });
});

describe("limite de colunas", () => {
  it("rejeita planilha com célula na última coluna do Excel sem materializar a faixa inteira", () => {
    // Um arquivo de poucos KB com células em A1 e XFD4 declara a faixa A1:XFD4. Sem o teto, o
    // sheet_to_json (defval "") criaria milhões de células e travaria o servidor por minutos.
    const sheet = XLSX.utils.aoa_to_sheet([["RULE_ID"], ["RULE_ID"], ["RULE_ID"]]);
    sheet.XFD4 = { t: "s", v: "x" };
    sheet["!ref"] = "A1:XFD4";
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Regras tributárias");
    const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

    const startedAt = Date.now();
    const { rawRows, errors } = parseTaxRuleSpreadsheet(buffer);

    assert.equal(rawRows.length, 0);
    assert.deepEqual(errors, [{ line: 1, message: `Planilha excede ${MAX_TAX_RULE_SHEET_COLUMNS} colunas` }]);
    assert.ok(Date.now() - startedAt < 2000, "o parse deveria falhar rápido, antes de materializar a faixa");
  });
});

describe("import pipeline for SHARK spreadsheet rows", () => {
  it("gera variantes completas para 4133250001 e 4133250002", () => {
    const buffer = buildWorkbookBuffer([
      ["612610", "4133250001", "SP", "Contribuinte", "99", 0],
      ["612610", "Item nacional", "RJ", "Não contribuinte", "99", 0],
      ["612610", "Item nacional", "RJ", "Envio de estoque (Transferência ou Remessa)", "99", 0],
      ["", "4133250002", "SP", "Contribuinte", "99", 0],
      ["", " ", "RJ", "Não contribuinte", "99", 0],
      ["", " ", "RJ", "Envio de estoque (Transferência ou Remessa)", "99", 0],
    ]);

    const parsed = parseTaxRuleSpreadsheet(buffer);
    const mapped = mapTaxRuleSpreadsheetRows(parsed.rawRows);

    assert.deepEqual(
      mapped.rows.map((row) => row.ruleId).sort(),
      [
        "4133250001-SP-non_taxpayer-sale",
        "4133250001-SP-taxpayer-inbound",
        "4133250001-SP-taxpayer-sale",
        "4133250002-SP-non_taxpayer-sale",
        "4133250002-SP-taxpayer-inbound",
        "4133250002-SP-taxpayer-sale",
      ].sort(),
    );
  });

  it("ignora ORIGIN de linhas de continuação com rótulo descritivo (formato ML novo)", () => {
    const buffer = buildWorkbookBuffer([
      ["612610", "4133250001", "SP", "Contribuinte", "99", 0],
      ["612610", "Item nacional", "RJ", "Não contribuinte", "99", 0],
      ["612610", "Item nacional", "RJ", "Envio de estoque (Transferência ou Remessa)", "99", 0],
    ]);

    const { rawRows } = parseTaxRuleSpreadsheet(buffer);
    assert.ok(rawRows.every((row) => row.origin === "SP"));
  });

  it("processa o arquivo real regra_shark_atualizada.xlsx quando disponível", () => {
    const filePath = "/Users/matheus/Downloads/regra_shark_atualizada.xlsx";
    try {
      readFileSync(filePath);
    } catch {
      return;
    }

    const parsed = parseTaxRuleSpreadsheet(readFileSync(filePath));
    const mapped = mapTaxRuleSpreadsheetRows(parsed.rawRows);
    const ruleIds = mapped.rows
      .filter((row) => row.ruleId.startsWith("4133250001-") || row.ruleId.startsWith("4133250002-"))
      .map((row) => row.ruleId)
      .sort();

    assert.deepEqual(ruleIds, [
      "4133250001-SP-non_taxpayer-sale",
      "4133250001-SP-taxpayer-inbound",
      "4133250001-SP-taxpayer-sale",
      "4133250002-SP-non_taxpayer-sale",
      "4133250002-SP-taxpayer-inbound",
      "4133250002-SP-taxpayer-sale",
    ]);
  });

  // Planilha real "MELI 23-10" (468 linhas). Os dados são do cliente e ficam fora do repositório:
  // aponte TAX_RULE_SAMPLE_XLSX_ML_23_10 para o arquivo. Sem a variável o teste aparece como
  // PULADO (e não como verde), para não fingir cobertura.
  const mlSamplePath = process.env.TAX_RULE_SAMPLE_XLSX_ML_23_10;

  it.skipIf(!mlSamplePath)(
    "importa as regras '<código> - IMPORTADO' da planilha ML 23-10 sem sobrescrever o grupo anterior",
    () => {
      const parsed = parseTaxRuleSpreadsheet(readFileSync(mlSamplePath!));
      const mapped = mapTaxRuleSpreadsheetRows(parsed.rawRows);
      const duplicates = mapped.errors.filter((error) => error.message.startsWith("Regra duplicada"));
      const family = mapped.rows
        .filter((row) => row.ruleId.startsWith("39259090"))
        .map((row) => row.ruleId)
        .sort();

      assert.equal(parsed.errors.length, 0);
      assert.equal(parsed.rawRows.length, 468);
      // Antes da correção do agrupamento eram 285 regras e 183 "duplicadas" falsas.
      assert.equal(mapped.rows.length, 462);
      // Restam só as duplicatas verdadeiras da planilha (82055900 e "82055900 - IMPORTADO"
      // aparecem duas vezes, com conteúdo idêntico).
      assert.equal(duplicates.length, 6);
      assert.deepEqual(family, [
        "39259090 - IMPORTADO-SP-non_taxpayer-sale",
        "39259090 - IMPORTADO-SP-taxpayer-inbound",
        "39259090 - IMPORTADO-SP-taxpayer-sale",
        "39259090-SP-non_taxpayer-sale",
        "39259090-SP-taxpayer-inbound",
        "39259090-SP-taxpayer-sale",
      ]);
    },
  );

  it("processa planilha ML nova com RULE_ID descritivo quando disponível", () => {
    const filePath = "/Users/matheus/Downloads/Regras_Tributarias-2026_6_17-1781704480754.xlsx";
    try {
      readFileSync(filePath);
    } catch {
      return;
    }

    const parsed = parseTaxRuleSpreadsheet(readFileSync(filePath));
    const mapped = mapTaxRuleSpreadsheetRows(parsed.rawRows);

    assert.equal(parsed.rawRows.length, 27);
    assert.equal(parsed.errors.length, 0);

    const uniqueRuleIds = [...new Set(parsed.rawRows.map((row) => row.ruleId))].sort();
    assert.deepEqual(uniqueRuleIds, [
      "355072",
      "355073",
      "355074",
      "355076",
      "355077",
      "355078",
      "355079",
      "538824",
      "760457",
    ]);

    const chuveiro = mapped.rows.filter((row) => row.ruleId.startsWith("355076-"));
    assert.equal(chuveiro.length, 3);
    assert.ok(chuveiro.every((row) => row.nome.startsWith("Chuveiro (")));
  });
});
