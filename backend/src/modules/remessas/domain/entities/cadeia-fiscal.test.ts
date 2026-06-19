import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CadeiaFiscalInvalidaError } from "../errors.js";
import { TipoNota } from "../value-objects/tipo-nota.js";
import { validarReferenciaFiscal } from "./cadeia-fiscal.js";

describe("validarReferenciaFiscal", () => {
  it("permite remessa inicial sem referência", () => {
    assert.doesNotThrow(() => validarReferenciaFiscal(TipoNota.REMESSA, null));
  });

  it("exige retorno simbólico referenciando remessa ou remessa avanço", () => {
    assert.doesNotThrow(() =>
      validarReferenciaFiscal(TipoNota.RETORNO_SIMBOLICO, TipoNota.REMESSA),
    );
    assert.doesNotThrow(() =>
      validarReferenciaFiscal(TipoNota.RETORNO_SIMBOLICO, TipoNota.REMESSA_AVANCO),
    );
    assert.throws(
      () => validarReferenciaFiscal(TipoNota.RETORNO_SIMBOLICO, null),
      CadeiaFiscalInvalidaError,
    );
  });

  it("exige remessa avanço referenciando retorno simbólico", () => {
    assert.doesNotThrow(() =>
      validarReferenciaFiscal(TipoNota.REMESSA_AVANCO, TipoNota.RETORNO_SIMBOLICO),
    );
    assert.throws(
      () => validarReferenciaFiscal(TipoNota.REMESSA_AVANCO, TipoNota.REMESSA),
      CadeiaFiscalInvalidaError,
    );
  });
});
