/** FDOC-1: cancelamento checa status fora de lock. 5 cancelamentos simultâneos da mesma venda. */
import { runWithDbContext } from "../../../backend/src/lib/db/tenant-rls.js";
import { CancellationUseCase } from "../../../backend/src/modules/fiscal-documents/cancellation/use-cases/cancellation.usecase.js";
import { makePrisma, seedTenants } from "./harness/db.js";
import { ownerDb, seedNfe, seedNfeItem, seedProduct } from "./harness/fixtures.js";

const CALLS = 5;
const app = makePrisma("app");
const useCase = new CancellationUseCase();

for (const variant of ["com retorno simbólico", "sem retorno simbólico"]) {
let confirmedRounds = 0;
for (let round = 1; round <= 5; round++) {
  const [t] = await seedTenants(1);
  const tenantId = t!.tenantId;
  const p = await seedProduct(tenantId);
  const remessa = await seedNfe(tenantId, { productId: p.id, tipo: "REMESSA", quantidade: 10, saldo: 7 });
  const item = await seedNfeItem(tenantId, remessa.id, p.id, 10, 7);
  const retorno = await seedNfe(tenantId, { productId: p.id, tipo: "RETORNO_SIMBOLICO", referenciaId: remessa.id, quantidade: 3 });
  await ownerDb().nfeRemessaConsumo.create({
    data: { retornoNfeId: retorno.id, remessaNfeId: remessa.id, nfeItemId: item.id, quantidade: 3 } as never,
  });
  const venda = await seedNfe(tenantId, { productId: p.id, tipo: "VENDA", referenciaId: variant === "com retorno simbólico" ? retorno.id : undefined, quantidade: 3 });

  const results = await Promise.allSettled(
    Array.from({ length: CALLS }, () =>
      runWithDbContext(app, { tenantId }, () => useCase.execute({ tenantId, nfeKey: venda.chave, justification: "Cancelamento de teste da auditoria" } as never)),
    ),
  );
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const errs = [...new Set(results.filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason?.message).slice(0, 60)))];
  const eventos = await ownerDb().fiscalEvent.count({ where: { nfeId: venda.id, tipo: "110111" } });
  const saldo = (await ownerDb().nfeItem.findUniqueOrThrow({ where: { id: item.id } })).saldoDisponivel;
  const bad = eventos > 1 || (variant === "com retorno simbólico" && (saldo ?? 0) > 10);
  if (bad) confirmedRounds++;
  console.log(`[${variant}] rodada ${round}: aceitos=${ok}/${CALLS}, eventos 110111 da venda=${eventos}, saldo do item=${saldo} (esperado 10) ${bad ? "← reentrante" : ""} ${errs.join(" | ")}`);
}

console.log(`VEREDITO [${variant}]: ${confirmedRounds > 0 ? `Confirmado (${confirmedRounds}/5 rodadas)` : "Refutado (5/5 rodadas limpas)"}`);
}
await app.$disconnect();
await ownerDb().$disconnect();
