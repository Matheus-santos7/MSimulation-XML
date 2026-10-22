import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { Product } from "../../product/product.types.js";
import type { TaxRuleService } from "../../../tax/index.js";
import type { ProductRepository } from "../../product/product.repository.js";
import type { ProductWriteData } from "../../product/types/product-write.types.js";
import { BulkUpsertProductsUseCase } from "../use-cases/bulk-upsert-products.usecase.js";

const tenantId = "tenant-1";

function rawRow(overrides: Record<string, unknown> = {}) {
  return {
    line: 2,
    sku: "SKU-1",
    nome: "Chuveiro Lorenzetti",
    ncm: "85161000",
    preco: "100,00",
    precoCusto: "50,00",
    origem: "0",
    unidade: "UN",
    estoque: "1",
    taxRuleBaseId: "Chuveiro",
    ...overrides,
  };
}

function fakeProductRepo(created: ProductWriteData[]): ProductRepository {
  return {
    getTenantUf: async () => "SP",
    listSkuIndex: async () => new Map(),
    create: async (_tenantId: string, data: ProductWriteData) => {
      created.push(data);
      return { id: "p1", tenantId, ...data } as Product;
    },
    update: async () => {
      throw new Error("update não deveria ser chamado");
    },
  } as unknown as ProductRepository;
}

function fakeTaxValidator(asserted: string[]): TaxRuleService {
  return {
    catalog: async () => [
      { baseId: "355076", nome: "Chuveiro", origin: "SP", label: "Chuveiro · origem SP" },
    ],
    assertProductTaxRuleBaseId: async (_tenantId: string, taxRuleBaseId: string) => {
      asserted.push(taxRuleBaseId);
    },
  } as unknown as TaxRuleService;
}

describe("BulkUpsertProductsUseCase tax rule ref", () => {
  it("grava taxRuleBaseId resolvido a partir do nome da família", async () => {
    const created: ProductWriteData[] = [];
    const asserted: string[] = [];
    const useCase = new BulkUpsertProductsUseCase(
      fakeProductRepo(created),
      fakeTaxValidator(asserted),
    );

    const result = await useCase.execute({ tenantId, rows: [rawRow()] });

    assert.equal(result.created, 1);
    assert.equal(result.failed.length, 0);
    assert.equal(created[0]!.taxRuleBaseId, "355076");
    assert.deepEqual(asserted, ["355076"]);
  });

  it("não aborta o lote quando o nome da regra não resolve", async () => {
    const created: ProductWriteData[] = [];
    const useCase = new BulkUpsertProductsUseCase(fakeProductRepo(created), fakeTaxValidator([]));

    const result = await useCase.execute({
      tenantId,
      rows: [rawRow({ taxRuleBaseId: "Torneira", sku: "SKU-FAIL" })],
    });

    assert.equal(result.created, 0);
    assert.equal(result.failed.length, 1);
    assert.match(result.failed[0]!.error, /não encontrada/i);
  });
});
