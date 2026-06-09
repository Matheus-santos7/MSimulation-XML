import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CadeiaFiscalInvalidaError } from "../errors.js";
import { TipoNota } from "../value-objects/tipo-nota.js";
import { validarReferenciaFiscal } from "./cadeia-fiscal.js";

describe("validarReferenciaFiscal", () => {
  it("permite remessa inicial sem referência", () => {
    assert.doesNotThrow(() => validarReferenciaFiscal(TipoNota.REMESSA, null));
  });

  it("exige retorno simbólico referenciando remessa", () => {
    assert.doesNotThrow(() =>
      validarReferenciaFiscal(TipoNota.RETORNO_SIMBOLICO, TipoNota.REMESSA),
    );
    assert.throws(
      () => validarReferenciaFiscal(TipoNota.RETORNO_SIMBOLICO, null),
      CadeiaFiscalInvalidaError,
    );
  });

  it("exige remessa simbólica referenciando retorno simbólico", () => {
    assert.doesNotThrow(() =>
      validarReferenciaFiscal(TipoNota.REMESSA_SIMBOLICA, TipoNota.RETORNO_SIMBOLICO),
    );
    assert.throws(
      () => validarReferenciaFiscal(TipoNota.REMESSA_SIMBOLICA, TipoNota.REMESSA),
      CadeiaFiscalInvalidaError,
    );
  });
});
