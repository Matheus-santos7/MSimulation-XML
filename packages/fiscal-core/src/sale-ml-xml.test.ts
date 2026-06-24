import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeTaxPercent, parseTaxPercent } from "./tax-percent.js";
import {
  CFOP_VENDA_NAO_CONTRIB_INTRA,
  CFOP_VENDA_NAO_CONTRIB_INTER,
  ML_NFE_VER_PROC,
  resolveSaleCfop,
  VENDA_ML_NAT_OP,
} from "./sale-cfop.js";

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
  it("usa CFOP explícito da regra quando compatível com a operação", () => {
    assert.equal(resolveSaleCfop("PR", "PR", "non_taxpayer", "5101"), "5101");
  });

  it("5106 intraestadual para não contribuinte (emitente → comprador)", () => {
    assert.equal(resolveSaleCfop("PR", "PR", "non_taxpayer", ""), CFOP_VENDA_NAO_CONTRIB_INTRA);
  });

  it("6106 interestadual para não contribuinte", () => {
    assert.equal(resolveSaleCfop("PR", "SC", "non_taxpayer", null), CFOP_VENDA_NAO_CONTRIB_INTER);
  });

  it("normaliza CFOP legado 5105 para 6106 em operação interestadual SP→MG", () => {
    assert.equal(resolveSaleCfop("SP", "MG", "non_taxpayer", "5105"), CFOP_VENDA_NAO_CONTRIB_INTER);
  });

  it("normaliza CFOP legado 6105 para 5106 em operação intraestadual", () => {
    assert.equal(resolveSaleCfop("SP", "SP", "non_taxpayer", "6105"), CFOP_VENDA_NAO_CONTRIB_INTRA);
  });

  it("não usa UF do CD: MG→MG com emitente SP deve ser interestadual", () => {
    assert.equal(resolveSaleCfop("SP", "MG", "non_taxpayer", ""), CFOP_VENDA_NAO_CONTRIB_INTER);
  });
});

describe("constantes ML venda", () => {
  it("natOp e verProc alinhados ao emissor ML", () => {
    assert.equal(VENDA_ML_NAT_OP, "Venda de mercadorias");
    assert.equal(ML_NFE_VER_PROC, "mercadolivre.invoice");
  });
});
