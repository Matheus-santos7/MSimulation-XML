/** S-2: a RLS depende do papel do banco. `app` (NOBYPASSRLS) vs `owner` (superusuário). */
import { runWithDbContext } from "../../../backend/src/lib/db/tenant-rls.js";
import { makePrisma, seedTenants } from "./harness/db.js";
import { ownerDb, seedProduct } from "./harness/fixtures.js";

const [a, b] = await seedTenants(2);
const pa = await seedProduct(a!.tenantId);
await seedProduct(b!.tenantId);

async function visible(role: "app" | "owner") {
  const db = makePrisma(role);
  const rows = await runWithDbContext(db, { tenantId: a!.tenantId }, (tx) =>
    tx.product.findMany({ where: { id: { not: "" } }, select: { id: true, tenantId: true } }),
  );
  await db.$disconnect();
  const ours = rows.filter((r) => r.tenantId === a!.tenantId || r.tenantId === b!.tenantId);

  return { total: ours.length, outros: ours.filter((r) => r.tenantId !== a!.tenantId).length };
}

const app = await visible("app");
const owner = await visible("owner");
console.log(`app (NOBYPASSRLS) no tenant A: ${app.total} produto(s), ${app.outros} de outro tenant (esperado 1/0; produto A=${pa.id.slice(0, 8)})`);
console.log(`owner (superusuário) no tenant A: ${owner.total} produto(s), ${owner.outros} de outro tenant`);
const confirmed = app.outros === 0 && owner.outros > 0;
console.log(`VEREDITO local: ${confirmed ? "Confirmado (a RLS só isola com papel sem BYPASSRLS/superusuário)" : "Refutado"}`);
await ownerDb().$disconnect();
