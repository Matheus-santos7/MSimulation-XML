import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NFeTipo } from "./nfe-tipo.js";
import { lineTotal, productUnitPrice, productUnitPriceForNfe } from "./product-pricing.js";

describe("fiscal-core / product-pricing", () => {
  const product = { preco: 100, precoCusto: 40 };

  it("productUnitPrice — remessa usa custo", () => {
    assert.equal(productUnitPrice(product, NFeTipo.REMESSA), 40);
    assert.equal(productUnitPrice(product, NFeTipo.VENDA), 100);
  });

  it("lineTotal arredonda em 2 casas", () => {
    assert.equal(lineTotal(10.333, 3), 31);
  });

  it("productUnitPriceForNfe — fallback sem produto", () => {
    assert.equal(
      productUnitPriceForNfe(undefined, { tipo: NFeTipo.VENDA, valor: 50, quantidade: 2 }),
      25,
    );
  });
});
