import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NFeTipo } from "./nfe-tipo.js";
import { resolvePisCofinsCstFromSnapshot } from "./pis-cofins-cst.js";

describe("resolvePisCofinsCstFromSnapshot", () => {
  it("mantém CST da planilha para remessa", () => {
    assert.equal(resolvePisCofinsCstFromSnapshot("09 - Suspensão", NFeTipo.REMESSA), "09");
  });

  it("força CST 98 no retorno simbólico (ML produção)", () => {
    assert.equal(
      resolvePisCofinsCstFromSnapshot("09 - Suspensão", NFeTipo.RETORNO_SIMBOLICO),
      "98",
    );
  });
});
