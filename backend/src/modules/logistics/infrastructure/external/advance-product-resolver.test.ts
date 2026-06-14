import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dbTransactionContext, type PrismaTransactionClient } from "../../../../lib/db/tenant-rls.js";
import { AdvanceProductResolverAdapter } from "./advance-product-resolver.adapter.js";

const tenantId = "tenant-b";
const productIdLegado = "prod-legado";
const productIdCadastro = "prod-cadastro";
const sku = "4133250058";

function createPrismaMock() {
  const productLegado = {
    id: productIdLegado,
    tenantId: "tenant-a",
    sku,
    nome: "Mop",
    ncm: "61091000",
    precoCusto: 100,
    taxRuleBaseId: "rule-1",
  };
  const productCadastro = {
    id: productIdCadastro,
    tenantId,
    sku,
    nome: "Mop",
    ncm: "61091000",
    precoCusto: 100,
    taxRuleBaseId: "rule-1",
  };

  return {
    product: {
      findFirst: async ({
        where,
      }: {
        where: { id?: string; tenantId?: string; sku?: string };
      }) => {
        if (where.tenantId !== tenantId) return null;
        if (where.sku === sku) return productCadastro;
        if (where.id === productIdCadastro) return productCadastro;
        if (where.id === productIdLegado) return null;
        return null;
      },
    },
    nfeItem: {
      findMany: async ({
        where,
      }: {
        where: {
          tenantId?: string;
          product?: { sku?: string };
          productId?: { in?: string[] };
        };
      }) => {
        if (where.tenantId !== tenantId) return [];
        if (where.product?.sku === sku) {
          return [{ productId: productIdLegado }];
        }
        return [];
      },
      findFirst: async ({
        where,
        include,
      }: {
        where: { tenantId?: string; productId?: string; saldoDisponivel?: { gt: number } };
        include?: { product?: boolean };
      }) => {
        if (where.tenantId !== tenantId) return null;
        const pid = where.productId;
        if (pid === productIdLegado || pid === productIdCadastro) {
          return include?.product
            ? { productId: productIdLegado, product: productLegado }
            : { productId: productIdLegado };
        }
        return null;
      },
    },
  } as unknown as PrismaTransactionClient;
}

async function withMockDb<T>(mock: PrismaTransactionClient, fn: () => Promise<T>): Promise<T> {
  return dbTransactionContext.run(mock, fn);
}

describe("ResolveAdvanceProductUseCase (AdvanceProductResolverAdapter)", () => {
  it("resolve pelo SKU do tenant mesmo quando o saldo FIFO usa product_id legado", async () => {
    await withMockDb(createPrismaMock(), async () => {
      const resolver = new AdvanceProductResolverAdapter();
      const result = await resolver.resolveForAdvance(tenantId, productIdLegado, sku);

      assert.ok(result);
      assert.equal(result.fifoProductId, productIdLegado);
      assert.equal(result.productId, productIdCadastro);
      assert.equal(result.sku, sku);
    });
  });

  it("resolve pelo SKU quando o productId enviado é o do cadastro e o FIFO é legado", async () => {
    await withMockDb(createPrismaMock(), async () => {
      const resolver = new AdvanceProductResolverAdapter();
      const result = await resolver.resolveForAdvance(tenantId, productIdCadastro, sku);

      assert.ok(result);
      assert.equal(result.fifoProductId, productIdLegado);
      assert.equal(result.productId, productIdCadastro);
    });
  });
});
