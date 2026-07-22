import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertAllowedBffPath, toBffPath } from "./bff-path.js";

describe("toBffPath", () => {
  it("converte caminho da API fiscal para o BFF", () => {
    assert.equal(toBffPath("/api/nfes/123/xml"), "/api/bff/nfes/123/xml");
    assert.equal(toBffPath("/api/nfes/123/xml?download=1"), "/api/bff/nfes/123/xml?download=1");
    assert.equal(
      toBffPath("/api/fiscal-settings/nfe-numeracao?serie=5&numeroInicial=1"),
      "/api/bff/fiscal-settings/nfe-numeracao?serie=5&numeroInicial=1",
    );
  });

  it("rejeita caminhos fora da allowlist", () => {
    assert.throws(() => toBffPath("/api/users/1"), /Caminho de API não permitido/);
  });
});

describe("assertAllowedBffPath", () => {
  it("permite downloads de planilha", () => {
    assert.doesNotThrow(() => assertAllowedBffPath("products/spreadsheet/export"));
    assert.doesNotThrow(() => assertAllowedBffPath("timeline/spreadsheet/export"));
  });
});
