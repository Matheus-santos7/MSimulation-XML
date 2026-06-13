import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeTaxPercent, parseTaxPercent } from "./tax-percent.js";
import { ML_NFE_VER_PROC, resolveSaleCfop, VENDA_ML_NAT_OP } from "./sale-cfop.js";

describe("normalizeTaxPercent", () => {
  it("converte alíquotas ML sem decimal (260 → 2,6)", () => {
    assert.equal(normalizeTaxPercent(260), 2.6);
    assert.equal(normalizeTaxPercent(165), 1.65);
    assert.equal(normalizeTaxPercent(760), 7.6);
  });

  it("mantém percentuais já decimais", () => {
    assert.equal(normalizeTaxPercent(2.6), 2.6);
    assert.equal(normalizeTaxPercent(18), 18);
  });

  it("parseTaxPercent aceita string com vírgula", () => {
    assert.equal(parseTaxPercent("2,6000"), 2.6);
  });
});

describe("resolveSaleCfop", () => {
  it("usa CFOP explícito da regra quando informado", () => {
    assert.equal(resolveSaleCfop("PR", "PR", "non_taxpayer", "5101"), "5101");
  });

  it("5105 intraestadual para não contribuinte (ML produção)", () => {
    assert.equal(resolveSaleCfop("PR", "PR", "non_taxpayer", ""), "5105");
  });

  it("6105 interestadual para não contribuinte", () => {
    assert.equal(resolveSaleCfop("PR", "SC", "non_taxpayer", null), "6105");
  });
});

describe("constantes ML venda", () => {
  it("natOp e verProc alinhados ao emissor ML", () => {
    assert.equal(VENDA_ML_NAT_OP, "Venda de mercadorias");
    assert.equal(ML_NFE_VER_PROC, "mercadolivre.invoice");
  });
});
