/**
 * RLS no Postgres real: toda tabela de negócio tem a policy `tenant_isolation` forçada, e o papel
 * da aplicação (sem `BYPASSRLS`) não lê linha de outro tenant. Pulado sem `INTEGRATION_TEST_DATABASE_URL`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWithDbContext } from "../lib/db/tenant-rls.js";
import {
  integrationDatabaseUrl,
  seedNfe,
  seedNfeItem,
  seedPedido,
  seedProduct,
  seedTenant,
  setupIntegrationDb,
  type IntegrationDb,
} from "./integration/postgres.js";

/** Fora da RLS por decisão: o próprio tenant, autenticação e o catálogo global de unidades. */
const TABLES_WITHOUT_RLS = [
  "_prisma_migrations",
  "tenants",
  "users",
  "user_sessions",
  "password_reset_tokens",
  "email_verification_tokens",
  "unidades_logisticas",
];

type TableRls = { table: string; enabled: boolean; forced: boolean; policy: boolean };

describe.skipIf(!integrationDatabaseUrl)("Row-Level Security (Postgres real)", () => {
  let db: IntegrationDb;

  beforeAll(async () => {
    db = await setupIntegrationDb();
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("should force the tenant_isolation policy on every business table", async () => {
    const rows = await db.owner.$queryRaw<TableRls[]>`
      SELECT c.relname AS table,
             c.relrowsecurity AS enabled,
             c.relforcerowsecurity AS forced,
             EXISTS (SELECT 1 FROM pg_policies p
                     WHERE p.tablename = c.relname AND p.policyname = 'tenant_isolation') AS policy
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`;

    const unprotected = rows
      .filter((row) => !TABLES_WITHOUT_RLS.includes(row.table))
      .filter((row) => !row.enabled || !row.forced || !row.policy)
      .map((row) => row.table);

    expect(unprotected).toEqual([]);
  });

  it("should hide child rows of another tenant from the app role", async () => {
    const seeded: Record<string, { itemIds: string[]; consumoId: string }> = {};
    const tenants = [await seedTenant(db.owner), await seedTenant(db.owner)];
    for (const tenantId of tenants) {
      const product = await seedProduct(db.owner, tenantId);
      const pedido = await seedPedido(db.owner, tenantId, [product.id]);
      const remessa = await seedNfe(db.owner, tenantId, { productId: product.id, saldo: 10 });
      const item = await seedNfeItem(db.owner, tenantId, remessa.id, product.id, {
        quantidade: 10,
        saldo: 10,
      });
      const retorno = await seedNfe(db.owner, tenantId, {
        productId: product.id,
        tipo: "RETORNO_SIMBOLICO",
        referenciaId: remessa.id,
      });
      const consumo = await db.owner.nfeRemessaConsumo.create({
        data: {
          retornoNfeId: retorno.id,
          remessaNfeId: remessa.id,
          nfeItemId: item.id,
          quantidade: 1,
        },
      });
      const itens = await db.owner.pedidoItem.findMany({ where: { pedidoId: pedido.id } });
      seeded[tenantId] = { itemIds: itens.map((i) => i.id), consumoId: consumo.id };
    }
    const [tenantA, tenantB] = tenants as [string, string];

    const seen = await runWithDbContext(db.app, { tenantId: tenantA }, async (tx) => ({
      itemIds: (await tx.pedidoItem.findMany({ select: { id: true } })).map((r) => r.id),
      consumoIds: (await tx.nfeRemessaConsumo.findMany({ select: { id: true } })).map((r) => r.id),
    }));

    expect(seen.itemIds).toEqual(expect.arrayContaining(seeded[tenantA]!.itemIds));
    expect(seen.consumoIds).toContain(seeded[tenantA]!.consumoId);
    expect(seen.itemIds).not.toEqual(expect.arrayContaining(seeded[tenantB]!.itemIds));
    expect(seen.consumoIds).not.toContain(seeded[tenantB]!.consumoId);
  });
});
