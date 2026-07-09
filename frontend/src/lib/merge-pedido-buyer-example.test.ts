import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findPedidoFormExample } from "./pedido-form-examples.js";
import { PEDIDO_FORM_EMPTY, PEDIDO_ITEM_EMPTY } from "./pedido-form-types.js";
import { mergePedidoBuyerExample } from "./merge-pedido-buyer-example.js";

describe("mergePedidoBuyerExample", () => {
  it("preserva frete já informado ao aplicar comprador de exemplo", () => {
    const example = findPedidoFormExample("cpf-sp");
    assert.ok(example);

    const current = {
      ...PEDIDO_FORM_EMPTY,
      items: [{ ...PEDIDO_ITEM_EMPTY, productId: "prod-1", quantidade: "2" }],
      freteConsumidor: "15.90",
      freteSeller: "8.50",
    };

    const merged = mergePedidoBuyerExample(current, example.values);

    assert.equal(merged.freteConsumidor, "15.90");
    assert.equal(merged.freteSeller, "8.50");
    assert.equal(merged.cpf, example.values.cpf);
    assert.equal(merged.nome, example.values.nome);
    assert.equal(merged.uf, example.values.uf);
    assert.deepEqual(merged.items, current.items);
  });
});
