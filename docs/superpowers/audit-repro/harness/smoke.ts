import { makePrisma, seedTenants } from "./db.js";

const [t] = await seedTenants(1);
const app = makePrisma("app");
const role = await app.$queryRaw<{ r: string }[]>`select current_user as r`;
console.log(`smoke ok: tenant=${t!.tenantId.length === 36} role=${role[0]!.r}`);
await app.$disconnect();
