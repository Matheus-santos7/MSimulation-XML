/**
 * P-4 no Postgres real: página de produtos com `skip`/`take`, total, busca sem diferenciar
 * maiúsculas e só os produtos do tenant (RLS + filtro). Pulado sem `INTEGRATION_TEST_DATABASE_URL`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWithDbContext } from "../../../../lib/db/tenant-rls.js";
import {
  integrationDatabaseUrl,
  seedTenant,
  setupIntegrationDb,
  type IntegrationDb,
} from "../../../../test/integration/postgres.js";
import { ProductRepository } from "../product.repository.js";

describe.skipIf(!integrationDatabaseUrl)(
  "ProductRepository.listPageByTenant (Postgres real)",
  () => {
    let db: IntegrationDb;
    let tenantId: string;

    beforeAll(async () => {
      db = await setupIntegrationDb();
      tenantId = await seedTenant(db.owner);
      const otherTenantId = await seedTenant(db.owner);
      const base = { ncm: "61091000", origem: 0, unidade: "UN", preco: 10, precoCusto: 5 };
      await db.owner.product.createMany({
        data: [
          { ...base, tenantId, sku: "A-1", nome: "Fogão Atlas" },
          { ...base, tenantId, sku: "A-2", nome: "Chuveiro" },
          { ...base, tenantId, sku: "A-3", nome: "fogão compacto" },
          { ...base, tenantId: otherTenantId, sku: "A-0", nome: "Fogão de outra empresa" },
        ],
      });
    }, 120_000);

    afterAll(async () => {
      await db?.close();
    });

    const listPage = (params: { page: number; perPage: number; filter?: string }) =>
      runWithDbContext(db.app, { tenantId }, () =>
        new ProductRepository().listPageByTenant(tenantId, params),
      );

    it("should return the requested window by SKU with the tenant total", async () => {
      const second = await listPage({ page: 2, perPage: 2 });

      expect(second.data.map((p) => p.sku)).toEqual(["A-3"]);
      expect(second).toMatchObject({ total: 3, page: 2, perPage: 2, totalPages: 2 });
    });

    it("should search SKU and name ignoring case", async () => {
      const result = await listPage({ page: 1, perPage: 10, filter: "FOGÃO" });

      expect(result.data.map((p) => p.sku)).toEqual(["A-1", "A-3"]);
      expect(result.total).toBe(2);
    });
  },
);
