import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTaxRuleRowId,
  taxRuleBaseIdFromRuleId,
  taxRuleLookupTransactionTypes,
  taxRuleOriginUf,
} from "./tax-rule-ids.js";

describe("tax-rule-ids", () => {
  it("inclui origem fiscal no ruleId da linha", () => {
    assert.equal(
      buildTaxRuleRowId("797515", "taxpayer", "sale", "rj"),
      "797515-RJ-taxpayer-sale",
    );
  });

  it("extrai baseId de ruleId com origem", () => {
    assert.equal(taxRuleBaseIdFromRuleId("797515-RJ-taxpayer-sale"), "797515");
    assert.equal(taxRuleBaseIdFromRuleId("797515-SP-non_taxpayer-sale"), "797515");
  });

  it("mantém compatibilidade com ruleId legado sem origem", () => {
    assert.equal(buildTaxRuleRowId("797515", "taxpayer", "sale"), "797515-taxpayer-sale");
    assert.equal(taxRuleBaseIdFromRuleId("797515-taxpayer-sale"), "797515");
  });

  it("taxRuleLookupTransactionTypes alias symbolic → inbound", () => {
    assert.deepEqual(taxRuleLookupTransactionTypes("symbolic_inbound_return"), [
      "symbolic_inbound_return",
      "inbound",
    ]);
    assert.deepEqual(taxRuleLookupTransactionTypes("inbound_return"), [
      "inbound_return",
      "inbound",
    ]);
    assert.deepEqual(taxRuleLookupTransactionTypes("inbound"), ["inbound"]);
    assert.deepEqual(taxRuleLookupTransactionTypes("sale"), ["sale"]);
  });

  it("parseia ruleId com symbolic_inbound_return", () => {
    assert.equal(
      taxRuleBaseIdFromRuleId("797515-SP-taxpayer-symbolic_inbound_return"),
      "797515",
    );
    assert.equal(
      buildTaxRuleRowId("797515", "taxpayer", "symbolic_inbound_return", "SP"),
      "797515-SP-taxpayer-symbolic_inbound_return",
    );
  });

  it("taxRuleOriginUf prioriza coluna uf e sufixo do ruleId", () => {
    assert.equal(
      taxRuleOriginUf({
        ruleId: "4133250001-SP-taxpayer-inbound",
        origin: "São Paulo",
        uf: "SP",
      }),
      "SP",
    );
    assert.equal(
      taxRuleOriginUf({ ruleId: "4133250001-PR-taxpayer-inbound", origin: "Paraná", uf: "PR" }),
      "PR",
    );
  });
});
