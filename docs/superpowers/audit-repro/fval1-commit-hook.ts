/**
 * FVAL-1: o hook pós-commit (revalidação de NF-e) só dispara quando runFiscalTransaction abre a
 * própria transação. (1) caminho HTTP: dentro de runWithDbContext; (2) fora de request.
 * Também mede o que o `db` entregue ao hook enxerga com RLS (papel app, sem set_config).
 */
import { registerFiscalTransactionCommitHook, runFiscalTransaction } from "../../../backend/src/lib/db/prisma-tx.js";
import { getDbClient, runWithDbContext } from "../../../backend/src/lib/db/tenant-rls.js";
import { makePrisma, seedTenants } from "./harness/db.js";
import { ownerDb, seedNfe, seedProduct } from "./harness/fixtures.js";

const [t] = await seedTenants(1);
const tenantId = t!.tenantId;
const p = await seedProduct(tenantId);
await seedNfe(tenantId, { productId: p.id, tipo: "VENDA" });
const app = makePrisma("app");

const calls: { visible: Promise<number> }[] = [];
registerFiscalTransactionCommitHook((db) => {
  calls.push({ visible: (db as typeof app).nFe.count({ where: { tenantId } }) });
});

await runWithDbContext(app, { tenantId }, () => runFiscalTransaction(getDbClient() as never, tenantId, async () => "emitido"));
const httpCalls = calls.length;

await runFiscalTransaction(app, tenantId, async () => "emitido");
const directCalls = calls.length - httpCalls;
const seen = directCalls > 0 ? await calls[calls.length - 1]!.visible : -1;

console.log(`caminho HTTP (dentro de runWithDbContext): hook chamado ${httpCalls} vez(es)`);
console.log(`fora de request (transação própria): hook chamado ${directCalls} vez(es); NF-e do tenant visíveis ao db do hook: ${seen} (há 1)`);
console.log(`VEREDITO: ${httpCalls === 0 ? "Confirmado" : "Refutado"} (HTTP); db do hook ${seen === 0 ? "não enxerga linhas (RLS sem set_config)" : "enxerga linhas"}`);
await app.$disconnect();
await ownerDb().$disconnect();
