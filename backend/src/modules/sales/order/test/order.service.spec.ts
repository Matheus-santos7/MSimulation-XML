import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
import { CheckoutError, OrderLockedError } from "../../errors/sales.errors.js";
import type { OrderRepository } from "../order.repository.js";
import { OrderService } from "../order.service.js";
import type { OrderCheckoutInput } from "../types/order-checkout-input.types.js";

const TENANT_ID = "tenant-01";
const INPUT = {
  marketplace: "MERCADO_LIVRE",
  items: [{ productId: "prod-1", quantidade: 1, xPed: "" }],
  comprador: { cpf: "12345678909", nome: "Comprador" },
  freteConsumidor: 10,
} as unknown as OrderCheckoutInput;

describe("OrderService", () => {
  let repository: Record<string, ReturnType<typeof vi.fn>>;
  let service: OrderService;

  beforeEach(() => {
    repository = {
      assertProductsBelongToTenant: vi.fn(async () => undefined),
      createDraft: vi.fn(async (_tenantId, data) => data),
      updateDraft: vi.fn(async (_id, data) => data),
      findStatus: vi.fn(async () => ({
        status: "RASCUNHO",
        marketplaceOrderId: "2000000000000009",
      })),
    };
    service = new OrderService(repository as unknown as OrderRepository);
  });

  it("should create the draft in the chosen marketplace with ids in its format", async () => {
    await service.createDraft(TENANT_ID, { ...INPUT, pedidoMl: "2000012345678901" });

    const data = repository.createDraft.mock.calls[0]![1];
    assert.equal(data.marketplace, "MERCADO_LIVRE");
    assert.equal(data.marketplaceOrderId, "2000012345678901");
    assert.match(data.items[0].xPed, /^\d{16}$/);
  });

  it("should reject a pack id outside the Mercado Livre format", async () => {
    await assert.rejects(
      () => service.createDraft(TENANT_ID, { ...INPUT, pedidoMl: "ML-123" }),
      CheckoutError,
    );
    assert.equal(repository.createDraft.mock.calls.length, 0);
  });

  it("should allow a draft for a marketplace whose invoicing is still pending", async () => {
    await service.createDraft(TENANT_ID, {
      ...INPUT,
      marketplace: "SHOPEE",
      pedidoMl: "250101ABC",
    });

    assert.equal(repository.createDraft.mock.calls[0]![1].marketplaceOrderId, "250101ABC");
  });

  it("should keep the existing order id when the update does not send one", async () => {
    await service.updateDraft("order-1", TENANT_ID, INPUT);

    assert.equal(repository.updateDraft.mock.calls[0]![1].marketplaceOrderId, "2000000000000009");
  });

  it("should refuse to update an invoiced order", async () => {
    repository.findStatus.mockResolvedValue({ status: "FATURADO", marketplaceOrderId: null });

    await assert.rejects(() => service.updateDraft("order-1", TENANT_ID, INPUT), OrderLockedError);
  });

  it("should return null when updating an order that does not exist", async () => {
    repository.findStatus.mockResolvedValue(null);

    assert.equal(await service.updateDraft("order-1", TENANT_ID, INPUT), null);
  });
});
