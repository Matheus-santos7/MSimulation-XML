import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseBrazilianPrice,
  validateProductImportRow,
} from "./validate-product-import-row.service.js";

describe("validateProductImportRow", () => {
  const base = {
    line: 2,
    sku: "300002137",
    nome: "Fogão 4 Bocas",
    ncm: "73211100",
    cest: "2100100",
    preco: "846,00",
    precoCusto: "520,00",
  };

  it("aceita linha válida com NCM e CEST corretos", () => {
    const result = validateProductImportRow(base);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.row.ncm, "73211100");
      assert.equal(result.row.cest, "2100100");
    }
  });

  it("rejeita NCM com tamanho inválido", () => {
    const result = validateProductImportRow({ ...base, ncm: "123" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /NCM/);
  });

  it("rejeita CEST com tamanho inválido", () => {
    const result = validateProductImportRow({ ...base, cest: "12345" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /CEST/);
  });
});

describe("parseBrazilianPrice", () => {
  it("interpreta formato BR", () => {
    assert.equal(parseBrazilianPrice("846,00"), 846);
    assert.equal(parseBrazilianPrice("1.234,56"), 1234.56);
  });

  it("permite zero no custo", () => {
    assert.equal(parseBrazilianPrice("0", { allowZero: true }), 0);
  });
});
