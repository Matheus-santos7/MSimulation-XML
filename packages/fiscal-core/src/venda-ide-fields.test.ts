import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveVendaIdeFields } from "./venda-ide-fields.js";

describe("resolveVendaIdeFields", () => {
  it("usa emitente quando saída física coincide com matriz", () => {
    const result = resolveVendaIdeFields({
      emitUf: "PR",
      emitCMun: "4118501",
      ufSaidaFisica: "PR",
    });
    assert.equal(result.cUf, "PR");
    assert.equal(result.cMunFG, "4118501");
  });

  it("mantém cUF do emitente e cMunFG do CD em fulfillment cross-UF", () => {
    const result = resolveVendaIdeFields({
      emitUf: "SP",
      emitCMun: "3525201",
      ufSaidaFisica: "SC",
      cMunSaidaFisica: "4204509",
    });
    assert.equal(result.cUf, "SP");
    assert.equal(result.cMunFG, "4204509");
  });

  it("fallback para emitCMun quando CD sem código IBGE", () => {
    const result = resolveVendaIdeFields({
      emitUf: "SP",
      emitCMun: "3525201",
      ufSaidaFisica: "SC",
    });
    assert.equal(result.cUf, "SP");
    assert.equal(result.cMunFG, "3525201");
  });
});
