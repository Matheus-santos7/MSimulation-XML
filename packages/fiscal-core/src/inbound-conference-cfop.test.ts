import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertMlInboundPositiveDifferenceCfop,
  InboundConferenceCfopError,
  ML_INBOUND_NEGATIVE_DIFFERENCE_CFOPS,
  ML_INBOUND_POSITIVE_DIFFERENCE_CFOPS,
  resolveInboundNegativeDifferenceCfop,
  resolveInboundPositiveDifferenceCfop,
} from "./inbound-conference-cfop.js";

describe("inbound-conference-cfop", () => {
  it("allowlist POSITIVE contém os 8 CFOPs da planilha", () => {
    assert.deepEqual([...ML_INBOUND_POSITIVE_DIFFERENCE_CFOPS].sort(), [
      "5152",
      "5904",
      "5949",
      "6151",
      "6152",
      "6409",
      "6904",
      "6949",
    ]);
  });

  it("allowlist NEGATIVE contém os 4 CFOPs da planilha", () => {
    assert.deepEqual([...ML_INBOUND_NEGATIVE_DIFFERENCE_CFOPS].sort(), [
      "1904",
      "1949",
      "2904",
      "2949",
    ]);
  });

  it("default POSITIVE 5949/6949 por UF", () => {
    assert.equal(resolveInboundPositiveDifferenceCfop("SP", "SP"), "5949");
    assert.equal(resolveInboundPositiveDifferenceCfop("SP", "MG"), "6949");
  });

  it("default NEGATIVE 1949/2949 por UF", () => {
    assert.equal(resolveInboundNegativeDifferenceCfop("SP", "SP"), "1949");
    assert.equal(resolveInboundNegativeDifferenceCfop("SP", "MG"), "2949");
  });

  it("override POSITIVE validado na allowlist", () => {
    assert.equal(resolveInboundPositiveDifferenceCfop("SP", "SP", "5904"), "5904");
    assert.throws(
      () => assertMlInboundPositiveDifferenceCfop("5102"),
      InboundConferenceCfopError,
    );
  });
});
