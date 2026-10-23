import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { CheckoutError } from "../../errors/sales.errors.js";
import {
  resolveMarketplaceOrderId,
  withMarketplaceItemOrderIds,
} from "../rules/marketplace-order-id.js";

describe("resolveMarketplaceOrderId", () => {
  it("should keep a valid Mercado Livre pack id, trimmed", () => {
    assert.equal(
      resolveMarketplaceOrderId("MERCADO_LIVRE", " 2000012345678901 "),
      "2000012345678901",
    );
  });

  it("should generate an id in the marketplace format when none is given", () => {
    assert.match(resolveMarketplaceOrderId("MERCADO_LIVRE", "  "), /^\d{16}$/);
    assert.match(resolveMarketplaceOrderId("SHOPEE", undefined), /^\d{16}$/);
  });

  it("should reject an id outside the Mercado Livre format", () => {
    assert.throws(
      () => resolveMarketplaceOrderId("MERCADO_LIVRE", "ML-123"),
      (error: unknown) =>
        error instanceof CheckoutError &&
        error.message === "Id do pedido no Mercado Livre deve ter só números (até 20 dígitos)",
    );
  });

  it("should accept any id for a marketplace whose rules are still pending", () => {
    assert.equal(resolveMarketplaceOrderId("SHOPEE", "250101ABC123"), "250101ABC123");
  });
});

describe("withMarketplaceItemOrderIds", () => {
  it("should keep given xPeds and fill the missing ones", () => {
    const items = withMarketplaceItemOrderIds("MERCADO_LIVRE", [
      { productId: "a", xPed: "2000000000000001" },
      { productId: "b", xPed: "" },
    ]);

    assert.equal(items[0]!.xPed, "2000000000000001");
    assert.match(items[1]!.xPed, /^\d{16}$/);
  });
});
