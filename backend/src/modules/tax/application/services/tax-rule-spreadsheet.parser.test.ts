import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { mapTaxRuleSpreadsheetRows } from "./tax-rule-spreadsheet-mapper.js";
import { parseTaxRuleSpreadsheet } from "./tax-rule-spreadsheet.parser.js";

function buildWorkbookBuffer(dataRows: (string | number)[][]): Buffer {
  const rows = [
    HEADER_KEYS.map(() => ""),
    HEADER_KEYS,
    HEADER_LABELS,
    ...dataRows,
  ];
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
      ["355076", "Chuveiro 8516100001 – Nacional", "SP", "Envio de estoque (Transferência ou Remessa)", "50", 0],
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
