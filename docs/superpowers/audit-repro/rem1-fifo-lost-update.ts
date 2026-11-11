/** REM-1: débito FIFO lê o saldo e grava valor absoluto. 20 débitos de 1 sobre saldo 10, em paralelo. */
import { runWithDbContext } from "../../../backend/src/lib/db/tenant-rls.js";
import { consumeRemessaFifoBalance } from "../../../backend/src/modules/remessas/stock-fifo/queries/remessa-fifo-consumption.js";
import { makePrisma, seedTenants } from "./harness/db.js";
import { ownerDb, seedNfe, seedNfeItem, seedProduct } from "./harness/fixtures.js";

const CALLS = 20;
const SALDO = 10;
const app = makePrisma("app");
let confirmedRounds = 0;

for (let round = 1; round <= 5; round++) {
  const [t] = await seedTenants(1);
  const tenantId = t!.tenantId;
  const p = await seedProduct(tenantId);
  const remessa = await seedNfe(tenantId, { productId: p.id, tipo: "REMESSA", saldo: SALDO, quantidade: SALDO });
  const item = await seedNfeItem(tenantId, remessa.id, p.id, SALDO, SALDO);
  const retornos = await Promise.all(
    Array.from({ length: CALLS }, () => seedNfe(tenantId, { productId: p.id, tipo: "RETORNO_SIMBOLICO", referenciaId: remessa.id })),
  );

  const results = await Promise.allSettled(
    retornos.map((r) =>
      runWithDbContext(app, { tenantId }, (tx) => consumeRemessaFifoBalance(tx as never, tenantId, p.id, 1, r.id)),
    ),
  );
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const final = (await ownerDb().nfeItem.findUniqueOrThrow({ where: { id: item.id } })).saldoDisponivel ?? 0;
  const consumos = await ownerDb().nfeRemessaConsumo.aggregate({ where: { nfeItemId: item.id }, _sum: { quantidade: true } });
  const consumido = consumos._sum.quantidade ?? 0;
  const lost = SALDO - final !== consumido || consumido > SALDO;
  if (lost) confirmedRounds++;
  console.log(`rodada ${round}: débitos aceitos=${ok}/${CALLS}, consumos registrados=${consumido}, saldo final=${final} (esperado ${SALDO - consumido}) ${lost ? "← lost update" : ""}`);
}

const checks = await ownerDb().$queryRaw<{ conname: string }[]>`select conname from pg_constraint where conrelid = 'nfe_itens'::regclass and contype = 'c'`;
console.log(`CHECK constraints em nfe_itens: ${checks.length === 0 ? "nenhuma" : checks.map((c) => c.conname).join(", ")}`);
console.log(`VEREDITO: ${confirmedRounds > 0 ? `Confirmado (${confirmedRounds}/5 rodadas)` : "Refutado (5/5 rodadas limpas)"}`);
await app.$disconnect();
await ownerDb().$disconnect();
