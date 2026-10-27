import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";
import { MarketplaceNotConfiguredError } from "@msimulation-xml/fiscal-core";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { SalesChainEmitter } from "../sales-chain/sales-chain.emitter.js";
import type { OrderForEmit } from "../types/order-for-emit.types.js";

const ORDER = {
  tenantId: "tenant-01",
  marketplace: "SHOPEE",
  items: [
    {
      productId: "prod-1",
      quantidade: 1,
      product: { id: "prod-1", ncm: "61091000", preco: 100, precoCusto: 50, taxRuleBaseId: "R1" },
    },
  ],
} as unknown as OrderForEmit;

describe("SalesChainEmitter", () => {
  it("should refuse to invoice a marketplace without fiscal profile before opening the transaction", async () => {
    const db = { $transaction: vi.fn() } as unknown as DbClient;

    await assert.rejects(
      () => new SalesChainEmitter().emit(db, ORDER),
      (error: unknown) =>
        error instanceof MarketplaceNotConfiguredError &&
        error.message === "Marketplace ainda não configurado para faturamento",
    );
    assert.equal(
      (db as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction.mock.calls.length,
      0,
    );
  });
});
