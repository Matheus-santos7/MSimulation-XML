/**
 * REM-1: débitos FIFO concorrentes no Postgres real. Pulado sem `INTEGRATION_TEST_DATABASE_URL`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWithDbContext } from "../../../../lib/db/tenant-rls.js";
import {
  integrationDatabaseUrl,
  seedNfe,
  seedNfeItem,
  seedProduct,
  seedTenant,
  setupIntegrationDb,
  type IntegrationDb,
} from "../../../../test/integration/postgres.js";
import { consumeRemessaFifoBalance } from "../queries/remessa-fifo-consumption.js";

const SALDO = 10;
const DEBITOS = 20;

describe.skipIf(!integrationDatabaseUrl)("consumeRemessaFifoBalance (Postgres real)", () => {
  let db: IntegrationDb;

  beforeAll(async () => {
    db = await setupIntegrationDb();
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("should never debit more than the balance under concurrent debits", async () => {
    const tenantId = await seedTenant(db.owner);
    const product = await seedProduct(db.owner, tenantId);
    const remessa = await seedNfe(db.owner, tenantId, {
      productId: product.id,
      saldo: SALDO,
      quantidade: SALDO,
    });
    const item = await seedNfeItem(db.owner, tenantId, remessa.id, product.id, {
      quantidade: SALDO,
      saldo: SALDO,
    });
    const retornos = await Promise.all(
      Array.from({ length: DEBITOS }, () =>
        seedNfe(db.owner, tenantId, {
          productId: product.id,
          tipo: "RETORNO_SIMBOLICO",
          referenciaId: remessa.id,
        }),
      ),
    );

    const results = await Promise.allSettled(
      retornos.map((retorno) =>
        runWithDbContext(db.app, { tenantId }, (tx) =>
          consumeRemessaFifoBalance(tx, tenantId, product.id, 1, retorno.id),
        ),
      ),
    );

    const aceitos = results.filter((r) => r.status === "fulfilled").length;
    const final = await db.owner.nfeItem.findUniqueOrThrow({ where: { id: item.id } });
    const consumos = await db.owner.nfeRemessaConsumo.aggregate({
      where: { nfeItemId: item.id },
      _sum: { quantidade: true },
    });
    expect(aceitos).toBe(SALDO);
    expect(consumos._sum.quantidade).toBe(SALDO);
    expect(final.saldoDisponivel).toBe(0);
  }, 60_000);
});
