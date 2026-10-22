import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";
import type { LogisticsUnitService, ProductMovementService } from "../../../logistics/index.js";
import { RemessaDomainError } from "../../errors/remessas.errors.js";
import type { FiscalChainNoteRepository } from "../../fiscal-chain/fiscal-chain-note.repository.js";
import type { StockFifoRepository } from "../../stock-fifo/stock-fifo.repository.js";
import { WarehouseAdvanceEmitUseCase } from "../use-cases/warehouse-advance-emit.usecase.js";
import type { WarehouseAdvanceFiscalEmitter } from "../warehouse-advance-fiscal.emitter.js";

const PRODUCT = { id: "prod-1", sku: "SKU-9", ncm: "61091000" };

vi.mock("../../../../lib/db/tenant-rls.js", () => ({
  getDbClient: () => ({ product: { findFirst: async () => PRODUCT } }),
}));

vi.mock("../../stock-fifo/remessa-fifo.js", () => ({
  resolveAdvanceFiscalOrigin: async (
    _db: unknown,
    _tenantId: string,
    _productId: string,
    unidadeOrigemId: string,
    _sku: string,
    getActive: (id: string) => Promise<unknown>,
  ) => ({ origem: await getActive(unidadeOrigemId), fifoOrigemId: unidadeOrigemId }),
  getAvailableRemessaBalance: async () => 10,
  debitRemessaBalanceByCd: vi.fn(),
  SaldoRemessaInsuficienteError: class extends Error {},
}));

const UNITS: Record<string, { id: string; marketplace: string; codigo: string; uf: string }> = {
  "cd-ml-sp": { id: "cd-ml-sp", marketplace: "MERCADO_LIVRE", codigo: "SP02", uf: "SP" },
  "cd-ml-sc": { id: "cd-ml-sc", marketplace: "MERCADO_LIVRE", codigo: "SC01", uf: "SC" },
  "cd-shopee-sp": { id: "cd-shopee-sp", marketplace: "SHOPEE", codigo: "SPX1", uf: "SP" },
};

const COMMAND = {
  tenantId: "tenant-01",
  productId: "prod-1",
  productSku: "SKU-9",
  quantidade: 1,
  unidadeOrigemId: "cd-ml-sp",
  unidadeDestinoId: "cd-shopee-sp",
};

describe("WarehouseAdvanceEmitUseCase", () => {
  let movements: {
    resolveAdvanceProduct: ReturnType<typeof vi.fn>;
    hasAdvanceStock: ReturnType<typeof vi.fn>;
  };
  let useCase: WarehouseAdvanceEmitUseCase;

  beforeEach(() => {
    const units = {
      getActive: async (id: string) => UNITS[id] ?? null,
      getActiveByCode: async () => null,
    } as unknown as LogisticsUnitService;
    movements = {
      resolveAdvanceProduct: vi.fn(async () => ({
        productId: PRODUCT.id,
        fifoProductId: PRODUCT.id,
      })),
      hasAdvanceStock: vi.fn(async () => false),
    };
    const stockFifo = {
      realignProductIdBySku: vi.fn(async () => 0),
    } as unknown as StockFifoRepository;

    useCase = new WarehouseAdvanceEmitUseCase(
      units,
      movements as unknown as ProductMovementService,
      stockFifo,
      {} as FiscalChainNoteRepository,
      {} as WarehouseAdvanceFiscalEmitter,
    );
  });

  it("should refuse to advance between CDs of different marketplaces", async () => {
    await assert.rejects(
      () => useCase.execute(COMMAND),
      (error: unknown) =>
        error instanceof RemessaDomainError &&
        error.message === "O avanço só pode ocorrer entre CDs do mesmo marketplace",
    );
  });

  it("should tell the product has FIFO stock but is missing from the catalog", async () => {
    movements.resolveAdvanceProduct.mockResolvedValue(null);
    movements.hasAdvanceStock.mockResolvedValue(true);

    await assert.rejects(
      () => useCase.execute({ ...COMMAND, unidadeDestinoId: "cd-ml-sc" }),
      /^RemessaDomainError: Há saldo FIFO \(SKU SKU-9\), mas o produto não está no cadastro/,
    );
  });

  it("should tell the product does not exist when there is no stock either", async () => {
    movements.resolveAdvanceProduct.mockResolvedValue(null);

    await assert.rejects(
      () => useCase.execute({ ...COMMAND, unidadeDestinoId: "cd-ml-sc" }),
      /^RemessaDomainError: Produto não encontrado nesta empresa \(SKU SKU-9\)/,
    );
  });

  it("should reject the same CD as origin and destination before any lookup", async () => {
    await assert.rejects(
      () => useCase.execute({ ...COMMAND, unidadeDestinoId: "cd-ml-sp" }),
      /CD de origem e destino devem ser diferentes/,
    );
    assert.equal(movements.resolveAdvanceProduct.mock.calls.length, 0);
  });
});
