import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NFeTipo } from "./nfe-tipo.js";
import {
  ICMS_CST_SYMBOLIC_RETURN,
  IPI_CST_SYMBOLIC_RETURN,
  resolveDefaultModFreteForTipo,
  resolveIcmsCstFromSnapshot,
  resolveIpiCstFromSnapshot,
  resolvePisCofinsCstFromSnapshot,
} from "./pis-cofins-cst.js";

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

  it("força CST 05 de IPI no retorno simbólico (ML produção)", () => {
    assert.equal(
      resolveIpiCstFromSnapshot("55 - Saída com Suspensão", NFeTipo.RETORNO_SIMBOLICO),
      IPI_CST_SYMBOLIC_RETURN,
    );
  });

  it("força CST 50 de ICMS no retorno simbólico (suspensão — evita ICMS00 zerado)", () => {
    assert.equal(
      resolveIcmsCstFromSnapshot("00 - Tributada integralmente", NFeTipo.RETORNO_SIMBOLICO),
      ICMS_CST_SYMBOLIC_RETURN,
    );
    assert.equal(
      resolveIcmsCstFromSnapshot("90 - Outras", NFeTipo.RETORNO_SIMBOLICO),
      ICMS_CST_SYMBOLIC_RETURN,
    );
  });

  it("modFrete padrão do retorno simbólico é 9 (sem transporte)", () => {
    assert.equal(resolveDefaultModFreteForTipo(NFeTipo.RETORNO_SIMBOLICO), "9");
  });
});
