/**
 * CAT-1 no Postgres real: a resposta do import bate com o que ficou gravado. Repositories reais.
 * Pulado sem `INTEGRATION_TEST_DATABASE_URL`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWithDbContext } from "../../../../lib/db/tenant-rls.js";
import {
  integrationDatabaseUrl,
  seedTenant,
  setupIntegrationDb,
  type IntegrationDb,
} from "../../../../test/integration/postgres.js";
import { TaxRuleRepository } from "../../../tax/tax-rule/tax-rule.repository.js";
import { TaxRuleService } from "../../../tax/tax-rule/tax-rule.service.js";
import { ProductRepository } from "../../product/product.repository.js";
import { BulkUpsertProductsUseCase } from "../use-cases/bulk-upsert-products.usecase.js";

function row(line: number, preco: number) {
  return {
    line,
    sku: `CAT1-${line}`,
    nome: `Produto ${line}`,
    ncm: "61091000",
    origem: 0,
    unidade: "UN",
    preco,
    precoCusto: 5,
    estoque: 1,
  };
}

describe.skipIf(!integrationDatabaseUrl)("BulkUpsertProductsUseCase (Postgres real)", () => {
  let db: IntegrationDb;

  beforeAll(async () => {
    db = await setupIntegrationDb();
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("should report as created exactly the products saved in the database", async () => {
    const tenantId = await seedTenant(db.owner);
    const useCase = new BulkUpsertProductsUseCase(
      new ProductRepository(),
      new TaxRuleService(new TaxRuleRepository(), db.app),
    );

    const result = await runWithDbContext(db.app, { tenantId }, () =>
      useCase.execute({
        tenantId,
        rows: [row(1, 10), row(2, 1e12), row(3, 10), row(4, 10), row(5, 10)],
      }),
    );

    const saved = await db.owner.product.count({ where: { tenantId } });
    expect(result.created).toBe(4);
    expect(saved).toBe(result.created);
  }, 60_000);
});
