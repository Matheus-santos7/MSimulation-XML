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
          origin: "RJ",
          transactionTypeLabel: "Não contribuinte",
        },
        {
          ruleId: "4133250001",
          ruleName: "4133250001",
          origin: "RJ",
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
    assert.equal(rawRows[2]!.origin, "RJ");
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
        "4133250001-RJ-non_taxpayer-sale",
        "4133250001-RJ-taxpayer-inbound",
        "4133250001-SP-taxpayer-sale",
        "4133250002-RJ-non_taxpayer-sale",
        "4133250002-RJ-taxpayer-inbound",
        "4133250002-SP-taxpayer-sale",
      ].sort(),
    );
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
      "4133250001-RJ-non_taxpayer-sale",
      "4133250001-RJ-taxpayer-inbound",
      "4133250001-SP-taxpayer-sale",
      "4133250002-RJ-non_taxpayer-sale",
      "4133250002-RJ-taxpayer-inbound",
      "4133250002-SP-taxpayer-sale",
    ]);
  });
});
