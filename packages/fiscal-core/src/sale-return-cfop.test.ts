import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMlSymbolicInboundReturnCfop,
  inferSymbolicReturnNaturezaFromRemessaCfop,
  ML_SYMBOLIC_INBOUND_RETURN_CFOPS,
  resolveSymbolicInboundReturnCfop,
  SymbolicReturnCfopError,
} from "./sale-return-cfop.js";

describe("ML_SYMBOLIC_INBOUND_RETURN_CFOPS", () => {
  it("cobre os 6 CFOPs da planilha SALE", () => {
    assert.deepEqual([...ML_SYMBOLIC_INBOUND_RETURN_CFOPS].sort(), [
      "1904",
      "1907",
      "1949",
      "2904",
      "2907",
      "2949",
    ]);
  });
});

describe("resolveSymbolicInboundReturnCfop", () => {
  it("outras_entradas → 1949/2949", () => {
    assert.equal(
      resolveSymbolicInboundReturnCfop({
        emitUf: "PR",
        destUf: "PR",
        natureza: "outras_entradas",
      }).cfop,
      "1949",
    );
    assert.equal(
      resolveSymbolicInboundReturnCfop({
        emitUf: "PR",
        destUf: "SC",
        natureza: "outras_entradas",
      }).cfop,
      "2949",
    );
  });

  it("retorno_venda_fora → 1904/2904", () => {
    assert.equal(
      resolveSymbolicInboundReturnCfop({
        emitUf: "SP",
        destUf: "SP",
        natureza: "retorno_venda_fora",
      }).cfop,
      "1904",
    );
    assert.equal(
      resolveSymbolicInboundReturnCfop({
        emitUf: "SP",
        destUf: "MG",
        natureza: "retorno_venda_fora",
      }).cfop,
      "2904",
    );
  });

  it("retorno_deposito → 1907/2907", () => {
    assert.equal(
      resolveSymbolicInboundReturnCfop({
        emitUf: "SP",
        destUf: "SP",
        natureza: "retorno_deposito",
      }).cfop,
      "1907",
    );
    assert.equal(
      resolveSymbolicInboundReturnCfop({
        emitUf: "SP",
        destUf: "SC",
        natureza: "retorno_deposito",
      }).cfop,
      "2907",
    );
  });

  it("infere depósito a partir da remessa 5905/6905", () => {
    assert.equal(
      resolveSymbolicInboundReturnCfop({
        emitUf: "PR",
        destUf: "PR",
        remessaCfop: "5905",
      }).cfop,
      "1907",
    );
    assert.equal(
      resolveSymbolicInboundReturnCfop({
        emitUf: "PR",
        destUf: "SC",
        remessaCfop: "6905",
      }).cfop,
      "2907",
    );
  });

  it("natureza settings prevalece sobre remessa", () => {
    assert.equal(
      resolveSymbolicInboundReturnCfop({
        emitUf: "PR",
        destUf: "PR",
        natureza: "outras_entradas",
        remessaCfop: "5905",
      }).cfop,
      "1949",
    );
  });
});

describe("inferSymbolicReturnNaturezaFromRemessaCfop", () => {
  it("mapeia sufixos 905/904/949", () => {
    assert.equal(inferSymbolicReturnNaturezaFromRemessaCfop("5905"), "retorno_deposito");
    assert.equal(inferSymbolicReturnNaturezaFromRemessaCfop("6904"), "retorno_venda_fora");
    assert.equal(inferSymbolicReturnNaturezaFromRemessaCfop("5949"), "outras_entradas");
  });
});

describe("assertMlSymbolicInboundReturnCfop", () => {
  it("rejeita fora da allowlist", () => {
    assert.throws(() => assertMlSymbolicInboundReturnCfop("1202"), SymbolicReturnCfopError);
  });
});
