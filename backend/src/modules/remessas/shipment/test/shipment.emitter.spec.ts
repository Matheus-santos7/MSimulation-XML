import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";
import { MarketplaceNotConfiguredError } from "@msimulation-xml/fiscal-core";
import type { Tenant } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import type { LogisticsUnitService, ProductMovementService } from "../../../logistics/index.js";
import { ShipmentEmitter } from "../shipment.emitter.js";
import type { PhysicalShipmentLineInput } from "../types/shipment-emission.types.js";

const LINES = [
  { product: { id: "prod-1" }, quantidade: 1 },
] as unknown as PhysicalShipmentLineInput[];
const EMITENTE = { uf: "SP", cnpj: "00000000000191", serie: 1, emitSnapshot: {} } as never;

describe("ShipmentEmitter", () => {
  it("should block the shipment to a CD whose marketplace has no fiscal profile, before writing", async () => {
    const units = {
      resolveShipmentDestination: async () => ({
        unitId: "cd-shopee",
        marketplace: "SHOPEE",
        codigo: "SPX1",
        uf: "SP",
        nome: "CD Shopee",
        destinatarioFiscal: {},
      }),
    } as unknown as LogisticsUnitService;
    const db = { $transaction: vi.fn() } as unknown as DbClient;
    const emitter = new ShipmentEmitter(units, {} as ProductMovementService);

    await assert.rejects(
      () => emitter.emit(db, { id: "tenant-01" } as Tenant, LINES, { emitenteOverride: EMITENTE }),
      MarketplaceNotConfiguredError,
    );
    assert.equal(
      (db as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction.mock.calls.length,
      0,
    );
  });

  it("should refuse an empty shipment", async () => {
    const emitter = new ShipmentEmitter({} as LogisticsUnitService, {} as ProductMovementService);

    await assert.rejects(
      () => emitter.emit({} as DbClient, { id: "tenant-01" } as Tenant, []),
      /Informe ao menos um produto na remessa/,
    );
  });
});
