/**
 * SAL-1/SAL-2: faturamentos concorrentes do mesmo pedido no Postgres real. Use case, service e
 * repository reais; o emissor é falso (grava uma NF-e de venda e demora) para isolar a trava.
 * Pulado sem `INTEGRATION_TEST_DATABASE_URL`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDbClient, runWithDbContext } from "../../../../lib/db/tenant-rls.js";
import {
  integrationDatabaseUrl,
  seedPedido,
  seedProduct,
  seedTenant,
  setupIntegrationDb,
  type IntegrationDb,
} from "../../../../test/integration/postgres.js";
import { OrderLockedError } from "../../errors/sales.errors.js";
import { OrderRepository } from "../../order/order.repository.js";
import { OrderService } from "../../order/order.service.js";
import type { SalesChainEmitter } from "../sales-chain/sales-chain.emitter.js";
import { OrderInvoiceUseCase } from "../use-cases/order-invoice.usecase.js";

const CHAMADAS = 5;
const EMIT_DELAY_MS = 150;

describe.skipIf(!integrationDatabaseUrl)("OrderInvoiceUseCase (Postgres real)", () => {
  let db: IntegrationDb;

  beforeAll(async () => {
    db = await setupIntegrationDb();
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("should invoice an order only once under concurrent requests", async () => {
    const tenantId = await seedTenant(db.owner);
    const product = await seedProduct(db.owner, tenantId);
    const pedido = await seedPedido(db.owner, tenantId, [product.id]);
    let numero = 0;
    const salesChain = {
      async emit() {
        await new Promise((resolve) => setTimeout(resolve, EMIT_DELAY_MS));
        numero += 1;
        const venda = await getDbClient().nFe.create({
          data: {
            tenantId,
            productId: product.id,
            chave: `35${Date.now()}${numero}`.padEnd(44, "1"),
            numero,
            serie: 1,
            natOp: "Venda",
            cfop: "5102",
            ncm: "61091000",
            destNome: "C",
            destDoc: "00000000191",
            destUf: "SP",
            valor: 10,
            valorIcms: 0,
            aliqIcms: 0,
            status: "AUTORIZADA",
            emitidaEm: new Date(),
            pedidoMl: "PED",
            marketplace: "MERCADO_LIVRE",
            tipo: "VENDA",
          },
        });

        return { venda: { id: venda.id, pedidoML: "PED" } };
      },
    };
    const useCase = new OrderInvoiceUseCase(
      new OrderService(new OrderRepository()),
      salesChain as unknown as SalesChainEmitter,
    );

    const results = await Promise.allSettled(
      Array.from({ length: CHAMADAS }, () =>
        runWithDbContext(db.app, { tenantId }, () => useCase.execute(tenantId, pedido.id)),
      ),
    );

    const rejected = results.filter((r) => r.status === "rejected");
    const vendas = await db.owner.nFe.count({ where: { tenantId, tipo: "VENDA" } });
    expect(vendas).toBe(1);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rejected.every((r) => r.reason instanceof OrderLockedError)).toBe(true);
  }, 60_000);
});
