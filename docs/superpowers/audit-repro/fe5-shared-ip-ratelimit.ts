/**
 * FE-5: login vindo da Server Action do Next chega ao backend sempre com o IP do servidor do
 * frontend (postAuthJson não repassa X-Forwarded-For). O limite de POST /api/auth/login é por IP
 * (10 / 15 min + ban). Simula 12 usuários diferentes passando pelo mesmo frontend.
 * App real (buildApp) com Prisma falso: nenhum usuário existe, cada login responde 401.
 */
process.env.JWT_SECRET = "audit-repro-secret-0123456789"; // mesmo padrão do app.contract.spec.ts
const { buildApp } = await import("../../../backend/src/app.js");

const tx = {
  $executeRaw: async () => 0,
  $queryRaw: async () => [],
  user: { findUnique: async () => null, findFirst: async () => null },
};
const fakePrisma = { $transaction: async (fn: (t: unknown) => unknown) => fn(tx), $disconnect: async () => {}, ...tx } as never;
const app = await buildApp({ prisma: fakePrisma, logger: false });
const FRONTEND_IP = "10.0.0.5";
const codes: number[] = [];
let blockedBody = "";
for (let i = 1; i <= 12; i++) {
  const res = await app.getHttpAdapter().getInstance().inject({
    method: "POST",
    url: "/api/auth/login",
    remoteAddress: FRONTEND_IP,
    payload: { email: `usuario${i}@exemplo.test`, password: "SenhaQualquer123!" },
  });
  codes.push(res.statusCode);
  if ((res.statusCode === 429 || res.statusCode === 403) && !blockedBody) blockedBody = res.body.slice(0, 120);
}
await app.close();
console.log(`12 usuários distintos via o mesmo IP do frontend: ${codes.join(", ")}`);
const firstLimited = codes.findIndex((c) => c === 429 || c === 403);
console.log(`corpo do primeiro bloqueio: ${blockedBody}`);
console.log(`VEREDITO: ${firstLimited >= 0 ? `Confirmado (o ${firstLimited + 1}º usuário já é bloqueado)` : "Refutado"}`);
