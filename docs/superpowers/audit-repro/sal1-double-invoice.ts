/**
 * SAL-1/SAL-2: OrderInvoiceUseCase lê o status, emite e só depois marca FATURADO.
 * Usa o use case, o service e o repository reais; o SalesChainEmitter é trocado por um falso que
 * grava uma NF-e de VENDA na mesma transação e leva 150 ms (isola o portão, sem regra fiscal).
 */
import { getDbClient, runWithDbContext } from "../../../backend/src/lib/db/tenant-rls.js";
import { OrderInvoiceUseCase } from "../../../backend/src/modules/sales/invoicing/use-cases/order-invoice.usecase.js";
import { OrderRepository } from "../../../backend/src/modules/sales/order/order.repository.js";
import { OrderService } from "../../../backend/src/modules/sales/order/order.service.js";
import { makePrisma, seedTenants } from "./harness/db.js";
import { ownerDb, seedPedido, seedProduct } from "./harness/fixtures.js";

const CALLS = 5;
const app = makePrisma("app");
let confirmedRounds = 0;

for (let round = 1; round <= 5; round++) {
  const [t] = await seedTenants(1);
  const tenantId = t!.tenantId;
  const p = await seedProduct(tenantId);
  const pedido = await seedPedido(tenantId, [p.id]);

  const fakeChain = {
    async emit(_db: unknown, order: { marketplaceOrderId?: string }) {
      void _db;
      await new Promise((r) => setTimeout(r, 150));
      const n = Math.floor(Math.random() * 1e9);
      const venda = await getDbClient().nFe.create({
        data: {
          tenantId, productId: p.id, chave: `35${String(n).padStart(42, "1")}`, numero: n, serie: 1,
          natOp: "Venda", cfop: "5102", ncm: "61091000", destNome: "C", destDoc: "00000000191",
          destUf: "SP", valor: 10, valorIcms: 0, aliqIcms: 0, status: "AUTORIZADA",
          emitidaEm: new Date(), pedidoMl: "PED", marketplace: "MERCADO_LIVRE", tipo: "VENDA",
        } as never,
      });

      return { venda: { id: venda.id, pedidoML: order.marketplaceOrderId ?? "X" } };
    },
  };
  const useCase = new OrderInvoiceUseCase(new OrderService(new OrderRepository()), fakeChain as never);

  const results = await Promise.allSettled(
    Array.from({ length: CALLS }, () => runWithDbContext(app, { tenantId }, () => useCase.execute(tenantId, pedido.id))),
  );
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const vendas = await ownerDb().nFe.count({ where: { tenantId, tipo: "VENDA" } });
  if (vendas > 1) confirmedRounds++;
  console.log(`rodada ${round}: faturamentos aceitos=${ok}/${CALLS}, NF-e de venda do pedido=${vendas}${vendas > 1 ? " ← duplicado" : ""}`);
}

console.log(`VEREDITO: ${confirmedRounds > 0 ? `Confirmado (${confirmedRounds}/5 rodadas)` : "Refutado (5/5 rodadas limpas)"}`);
await app.$disconnect();
await ownerDb().$disconnect();
