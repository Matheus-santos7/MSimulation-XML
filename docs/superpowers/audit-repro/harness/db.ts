/**
 * Harness da verificação da auditoria: clientes Prisma contra o Postgres descartável (audit-pg).
 * Rodar sempre com `harness/run.sh` (desliga o dotenv e fixa a URL local).
 */
import { createRequire } from "node:module";
import { PrismaClient } from "../../../../backend/src/generated/prisma/client.js";

const requireFromBackend = createRequire(new URL("../../../../backend/package.json", import.meta.url));
const { PrismaPg } = requireFromBackend("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");

export const LOCAL_URLS = {
  owner: "postgresql://audit:audit@127.0.0.1:55432/audit",
  app: "postgresql://audit_app:audit_app@127.0.0.1:55432/audit",
} as const;

export function makePrisma(role: "owner" | "app"): PrismaClient {
  const url = LOCAL_URLS[role];
  if (!url.includes("127.0.0.1:55432")) throw new Error("URL não local");

  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 30 }) });
}

let seq = 0;

/** Cria `n` tenants com CNPJs distintos (como dono, sem RLS). */
export async function seedTenants(n: number): Promise<{ tenantId: string }[]> {
  const db = makePrisma("owner");
  const out: { tenantId: string }[] = [];
  for (let i = 0; i < n; i++) {
    seq += 1;
    const cnpj = String(Date.now() % 1e9).padStart(9, "0") + String(seq).padStart(5, "0");
    const t = await db.tenant.create({
      data: {
        razaoSocial: `Empresa ${seq}`,
        nomeFantasia: `E${seq}`,
        cnpj,
        ie: "123",
        logradouro: "Rua A",
        bairro: "Centro",
        codigoMunicipio: "3550308",
        municipio: "São Paulo",
        uf: "SP",
        cep: "01001000",
        ambiente: "HOMOLOGACAO",
      },
    });
    out.push({ tenantId: t.id });
  }
  await db.$disconnect();

  return out;
}
