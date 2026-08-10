import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isInterstateByCfopOrUf, resolveFcpPlacement } from "./fcp-placement.js";

describe("isInterstateByCfopOrUf", () => {
  it("CFOP 5xxx = interno mesmo com UFs diferentes", () => {
    assert.equal(isInterstateByCfopOrUf("5102", "SP", "RJ"), false);
  });

  it("CFOP 6xxx = interestadual", () => {
    assert.equal(isInterstateByCfopOrUf("6102", "SP", "SP"), true);
  });

  it("sem CFOP cai na comparação de UF", () => {
    assert.equal(isInterstateByCfopOrUf(undefined, "SP", "RJ"), true);
    assert.equal(isInterstateByCfopOrUf(undefined, "SP", "SP"), false);
  });
});

describe("resolveFcpPlacement", () => {
  it("interno (CFOP 5xxx): FCP no ICMS próprio, sem UFDest", () => {
    const p = resolveFcpPlacement({
      cfop: "5102",
      ufOrigem: "SP",
      ufDestino: "SP",
      isFinalConsumer: true,
      appliesDifal: false,
      pFcpFromRule: 2,
      pFcpStFromRule: 0,
      hasSt: false,
    });
    assert.equal(p.scenario, "interno");
    assert.equal(p.pFCP, 2);
    assert.equal(p.pFCPUFDest, 0);
  });

  it("DIFAL EC 87: FCP só em UFDest — zera pFCP próprio", () => {
    const p = resolveFcpPlacement({
      cfop: "6108",
      ufOrigem: "SP",
      ufDestino: "RJ",
      isFinalConsumer: true,
      appliesDifal: true,
      pFcpFromRule: 2,
      pFcpStFromRule: 0,
      hasSt: false,
    });
    assert.equal(p.scenario, "difal_ec87");
    assert.equal(p.pFCP, 0);
    assert.equal(p.pFCPUFDest, 2);
  });

  it("interestadual B2B sem DIFAL: FCP no ICMS próprio", () => {
    const p = resolveFcpPlacement({
      cfop: "6102",
      ufOrigem: "SP",
      ufDestino: "MG",
      isFinalConsumer: false,
      appliesDifal: false,
      pFcpFromRule: 1,
      pFcpStFromRule: 0,
      hasSt: false,
    });
    assert.equal(p.scenario, "interestadual_sem_difal");
    assert.equal(p.pFCP, 1);
    assert.equal(p.pFCPUFDest, 0);
  });

  it("ST preserva pFCPST em qualquer cenário", () => {
    const interno = resolveFcpPlacement({
      cfop: "5403",
      ufOrigem: "SP",
      ufDestino: "SP",
      isFinalConsumer: false,
      appliesDifal: false,
      pFcpFromRule: 2,
      pFcpStFromRule: 2,
      hasSt: true,
    });
    assert.equal(interno.pFCPST, 2);

    const difal = resolveFcpPlacement({
      cfop: "6403",
      ufOrigem: "SP",
      ufDestino: "RJ",
      isFinalConsumer: true,
      appliesDifal: true,
      pFcpFromRule: 2,
      pFcpStFromRule: 2,
      hasSt: true,
    });
    assert.equal(difal.pFCP, 0);
    assert.equal(difal.pFCPUFDest, 2);
    assert.equal(difal.pFCPST, 2);
  });

  it("alíquota zero da regra não inventa FCP", () => {
    const p = resolveFcpPlacement({
      cfop: "5102",
      ufOrigem: "SP",
      ufDestino: "SP",
      isFinalConsumer: true,
      appliesDifal: false,
      pFcpFromRule: 0,
      pFcpStFromRule: 0,
      hasSt: false,
    });
    assert.equal(p.pFCP, 0);
    assert.equal(p.pFCPUFDest, 0);
  });
});
