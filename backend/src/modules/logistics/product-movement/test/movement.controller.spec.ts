import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { HttpError } from "../../../../lib/http/http-error.js";
import { RemessaDomainError } from "../../../remessas/domain/errors.js";
import type { RemessasContext } from "../../../remessas/remessas.tokens.js";
import type { ProductMovementService } from "../product-movement.service.js";
import { MovementController } from "../movement.controller.js";

const TENANT_ID = "tenant-1";
const SHIPMENT = { unidadeDestinoId: "cd-1", items: [] } as never;
const ADVANCE = {
  productId: " p-1 ",
  productSku: "SKU-9",
  quantidade: 1,
  unidadeOrigemId: "a",
  unidadeDestinoId: "b",
} as never;

function controller(options: {
  emit?: () => Promise<unknown>;
  resolvedProduct?: unknown;
  hasStock?: boolean;
}): MovementController {
  const movements = {
    resolveAdvanceProduct: async () => options.resolvedProduct ?? null,
    hasAdvanceStock: async () => options.hasStock ?? false,
  } as unknown as ProductMovementService;
  const remessas = {
    emitirRemessaInicial: { execute: options.emit ?? (async () => ({ ok: true })) },
  } as unknown as RemessasContext;

  return new MovementController(movements, remessas);
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("esperava erro");
}

describe("MovementController", () => {
  it("devolve o resultado da emissão da remessa", async () => {
    assert.deepEqual(await controller({}).emitShipment(TENANT_ID, SHIPMENT), { ok: true });
  });

  it("traduz erro de domínio da remessa em 400", async () => {
    const error = await rejection(
      controller({
        emit: async () => {
          throw new RemessaDomainError("Sem saldo no CD");
        },
      }).emitShipment(TENANT_ID, SHIPMENT),
    );

    assert.ok(error instanceof HttpError);
    assert.deepEqual([error.status, error.message], [400, "Sem saldo no CD"]);
  });

  it("traduz timeout da transação (P2028) em 503", async () => {
    const error = await rejection(
      controller({
        emit: async () => {
          throw Object.assign(new Error("Transaction timeout"), { code: "P2028" });
        },
      }).emitShipment(TENANT_ID, SHIPMENT),
    );

    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 503);
  });

  it("relança erro desconhecido sem traduzir", async () => {
    const original = new Error("falha inesperada");

    const error = await rejection(
      controller({
        emit: async () => {
          throw original;
        },
      }).emitShipment(TENANT_ID, SHIPMENT),
    );

    assert.equal(error, original);
  });

  it("recusa o avanço com 400 quando o produto não está no cadastro", async () => {
    const withStock = await rejection(
      controller({ hasStock: true }).advanceWarehouse(TENANT_ID, ADVANCE),
    );
    const withoutStock = await rejection(
      controller({ hasStock: false }).advanceWarehouse(TENANT_ID, ADVANCE),
    );

    assert.ok(withStock instanceof HttpError && withoutStock instanceof HttpError);
    assert.equal(withStock.status, 400);
    assert.match(withStock.message, /^Há saldo FIFO \(SKU SKU-9\)/);
    assert.match(withoutStock.message, /^Produto não encontrado nesta empresa \(SKU SKU-9\)/);
  });
});
