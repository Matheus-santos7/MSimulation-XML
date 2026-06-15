import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isImportedInterstateOrigin,
  resolveFiscalExitUf,
  resolveInterstateIcmsRateForProductOrigin,
  SENATE_RESOLUTION_IMPORT_INTERSTATE_RATE,
} from "./interstate-icms.js";

describe("interstate-icms", () => {
  it("identifica origens importadas sujeitas à alíquota de 4%", () => {
    assert.equal(isImportedInterstateOrigin(1), true);
    assert.equal(isImportedInterstateOrigin(2), true);
    assert.equal(isImportedInterstateOrigin(3), true);
    assert.equal(isImportedInterstateOrigin(8), true);
    assert.equal(isImportedInterstateOrigin(0), false);
    assert.equal(isImportedInterstateOrigin(5), false);
  });

  it("força 4% em operação interestadual para origem importada", () => {
    assert.equal(
      resolveInterstateIcmsRateForProductOrigin(2, true, 19.5),
      SENATE_RESOLUTION_IMPORT_INTERSTATE_RATE,
    );
    assert.equal(resolveInterstateIcmsRateForProductOrigin(2, false, 19.5), 19.5);
    assert.equal(resolveInterstateIcmsRateForProductOrigin(5, true, 12), 12);
  });

  it("resolve UF de saída física com fallback no emitente", () => {
    assert.equal(resolveFiscalExitUf("SP", "SC"), "SC");
    assert.equal(resolveFiscalExitUf("SP", null), "SP");
    assert.equal(resolveFiscalExitUf("pr", "sc"), "SC");
  });
});
