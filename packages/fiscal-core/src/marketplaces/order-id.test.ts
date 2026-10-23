import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Marketplace } from "./marketplace.js";
import { gerarIdPedidoNumerico } from "./order-id.js";
import { getMarketplaceProfile } from "./registry.js";

describe("id do pedido no marketplace", () => {
  it("gera 16 dígitos começando por 2", () => {
    const id = gerarIdPedidoNumerico(() => 1_792_000_000_000);

    assert.match(id, /^21792000000000\d{2}$/);
  });

  it("Mercado Livre aceita só dígitos", () => {
    const { pedido } = getMarketplaceProfile(Marketplace.MERCADO_LIVRE);

    assert.equal(pedido.validar("2000012345678901"), null);
    assert.equal(
      pedido.validar("ML-123"),
      "Id do pedido no Mercado Livre deve ter só números (até 20 dígitos)",
    );
    assert.match(pedido.gerar(), /^\d{16}$/);
  });

  it("marketplace pendente aceita qualquer id", () => {
    for (const code of [Marketplace.SHOPEE, Marketplace.AMAZON, Marketplace.MAGALU]) {
      assert.equal(getMarketplaceProfile(code).pedido.validar("250101ABC123"), null);
    }
  });
});
