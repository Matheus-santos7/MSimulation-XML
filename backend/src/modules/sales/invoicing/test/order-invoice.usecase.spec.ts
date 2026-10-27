import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
import { OrderLockedError } from "../../errors/sales.errors.js";
import type { OrderService } from "../../order/order.service.js";
import type { SalesChainEmitter } from "../sales-chain/sales-chain.emitter.js";
import { OrderInvoiceUseCase } from "../use-cases/order-invoice.usecase.js";

vi.mock("../../../../lib/db/tenant-rls.js", () => ({ getDbClient: () => ({}) }));

const TENANT_ID = "tenant-01";
const ORDER_ID = "00000000-0000-4000-8000-000000000001";

describe("OrderInvoiceUseCase", () => {
  let orders: Record<string, ReturnType<typeof vi.fn>>;
  let emit: ReturnType<typeof vi.fn>;
  let useCase: OrderInvoiceUseCase;

  beforeEach(() => {
    orders = {
      get: vi.fn(async () => ({ id: ORDER_ID, status: "RASCUNHO" })),
      findForEmit: vi.fn(async () => ({ marketplace: "MERCADO_LIVRE", marketplaceOrderId: "200" })),
      markInvoiced: vi.fn(async () => ({ id: ORDER_ID, status: "FATURADO" })),
    };
    emit = vi.fn(async () => ({ venda: { id: "nfe-1", pedidoML: "200" } }));
    useCase = new OrderInvoiceUseCase(
      orders as unknown as OrderService,
      { emit } as unknown as SalesChainEmitter,
    );
  });

  it("should emit the sales chain and mark the order as invoiced with the sale NF-e", async () => {
    const result = await useCase.execute(TENANT_ID, ORDER_ID);

    assert.deepEqual(orders.markInvoiced.mock.calls[0], [ORDER_ID, "200", "nfe-1"]);
    assert.equal(result?.pedido.status, "FATURADO");
  });

  it("should return null when the order does not exist", async () => {
    orders.get.mockResolvedValue(null);

    assert.equal(await useCase.execute(TENANT_ID, ORDER_ID), null);
    assert.equal(emit.mock.calls.length, 0);
  });

  it("should refuse an order that was already invoiced", async () => {
    orders.get.mockResolvedValue({ id: ORDER_ID, status: "FATURADO" });

    await assert.rejects(() => useCase.execute(TENANT_ID, ORDER_ID), OrderLockedError);
    assert.equal(emit.mock.calls.length, 0);
  });
});
