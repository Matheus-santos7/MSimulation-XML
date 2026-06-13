import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeProductNfci,
  requiresProductNfci,
  resolveProductNfci,
  validateProductNfciForOrigem,
} from "./product-nfci.js";

describe("product-nfci", () => {
  it("requiresProductNfci — origens 3, 5 e 8", () => {
    assert.equal(requiresProductNfci(5), true);
    assert.equal(requiresProductNfci(3), true);
    assert.equal(requiresProductNfci(8), true);
    assert.equal(requiresProductNfci(0), false);
    assert.equal(requiresProductNfci(1), false);
  });

  it("validateProductNfciForOrigem exige UUID nas origens FCI", () => {
    assert.match(
      validateProductNfciForOrigem(5, undefined),
      /obrigatório/i,
    );
    assert.match(
      validateProductNfciForOrigem(5, "invalid"),
      /UUID/i,
    );
    assert.equal(
      validateProductNfciForOrigem(5, "A7B816FF-59CC-41D9-97C1-B39BCED07B17"),
      null,
    );
  });

  it("validateProductNfciForOrigem rejeita nFCI em origem 0", () => {
    assert.match(
      validateProductNfciForOrigem(0, "A7B816FF-59CC-41D9-97C1-B39BCED07B17"),
      /origens 3, 5 e 8/i,
    );
  });

  it("resolveProductNfci limpa valor quando origem não exige FCI", () => {
    assert.equal(resolveProductNfci(0, "A7B816FF-59CC-41D9-97C1-B39BCED07B17"), undefined);
    assert.equal(
      resolveProductNfci(5, "A7B816FF-59CC-41D9-97C1-B39BCED07B17"),
      "A7B816FF-59CC-41D9-97C1-B39BCED07B17",
    );
  });

  it("normalizeProductNfci trim", () => {
    assert.equal(
      normalizeProductNfci("  A7B816FF-59CC-41D9-97C1-B39BCED07B17  "),
      "A7B816FF-59CC-41D9-97C1-B39BCED07B17",
    );
  });
});
