import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TaxRuleSpreadsheetRawRow } from "../../domain/entities/tax-rule-spreadsheet-raw-row.entity.js";
import { mapTaxRuleSpreadsheetRows } from "./tax-rule-spreadsheet-mapper.js";

function rawRow(overrides: Partial<TaxRuleSpreadsheetRawRow> = {}): TaxRuleSpreadsheetRawRow {
  return {
    line: 5,
    ruleId: "797515",
    ruleName: "Eletrodomésticos",
    origin: "PR",
    transactionTypeLabel: "Contribuinte",
    cells: {
      IPI_ST: "55",
      IPI_ALIQUOTA: 0,
      PIS_ST: "09",
      PIS_ALIQUOTA: 0,
      COFINS_ST: "09",
      COFINS_ALIQUOTA: 0,
      IBS_CBS_ST: "410",
      IBS_CBS_CCLASSTRIB: "410999",
      ICMS_PR_PICMS_INTERNAL: 18,
    },
    ...overrides,
  };
}

describe("mapTaxRuleSpreadsheetRows", () => {
  it("classifica venda para contribuinte", () => {
    const { rows, errors } = mapTaxRuleSpreadsheetRows([rawRow()]);
    assert.equal(errors.length, 0);
    assert.equal(rows[0]!.ruleId, "797515-PR-taxpayer-sale");
    assert.equal(rows[0]!.transactionType, "sale");
    assert.equal(rows[0]!.customerType, "taxpayer");
    assert.match(rows[0]!.nome, /Contribuinte\)$/);
  });

  it("classifica inbound para envio de estoque", () => {
    const { rows } = mapTaxRuleSpreadsheetRows([
      rawRow({ transactionTypeLabel: "Envio de estoque (Transferência ou Remessa)" }),
    ]);
    assert.equal(rows[0]!.ruleId, "797515-PR-taxpayer-inbound");
    assert.equal(rows[0]!.transactionType, "inbound");
  });

  it("classifica não contribuinte / consumidor final", () => {
    const { rows } = mapTaxRuleSpreadsheetRows([
      rawRow({ transactionTypeLabel: "Não contribuinte / Consumidor final" }),
    ]);
    assert.equal(rows[0]!.customerType, "non_taxpayer");
  });

  it("monta payload de impostos e icmsByUf", () => {
    const { rows } = mapTaxRuleSpreadsheetRows([rawRow()]);
    const payload = rows[0]!.payload as {
      taxes: { ipi: { st: string }; pis: { st: string } };
      icmsByUf: Record<string, unknown>;
    };
    assert.equal(payload.taxes.ipi.st, "55");
    assert.equal(payload.taxes.pis.st, "09");
    assert.equal(payload.icmsByUf.ICMS_PR_PICMS_INTERNAL, 18);
    assert.equal(rows[0]!.aliquota, "18");
  });

  it("rejeita ORIGIN com menos de 2 caracteres", () => {
    const { rows, errors } = mapTaxRuleSpreadsheetRows([rawRow({ origin: "P" })]);
    assert.equal(rows.length, 0);
    assert.equal(errors[0]?.message, "ORIGIN inválida (esperado UF com 2 letras)");
  });
});
