import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRetornoSimbolicoCfop } from "./retorno-simbolico-dest.js";

describe("resolveRetornoSimbolicoCfop", () => {
  it("usa 1949 na mesma UF (entrada intraestadual)", () => {
    assert.equal(resolveRetornoSimbolicoCfop("PR", "PR"), "1949");
    assert.equal(resolveRetornoSimbolicoCfop("sp", "SP"), "1949");
  });

  it("usa 2949 entre UFs diferentes (entrada interestadual)", () => {
    assert.equal(resolveRetornoSimbolicoCfop("PR", "SC"), "2949");
    assert.equal(resolveRetornoSimbolicoCfop("SP", "MG"), "2949");
  });
});
