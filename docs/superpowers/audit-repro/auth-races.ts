/**
 * AUTH-1: o mesmo token de redefinição usado por 10 requisições simultâneas.
 * AUTH-7: 10 onboardings simultâneos do mesmo usuário com CNPJs distintos.
 * Repositories e use cases reais; hasher, TOTP, lockout e emissão de sessão são falsos.
 */
import { randomUUID } from "node:crypto";
import { runWithDbContext } from "../../../backend/src/lib/db/tenant-rls.js";
import { OnboardingRepository } from "../../../backend/src/modules/auth/onboarding/onboarding.repository.js";
import { AttachTenantOnboardingUseCase } from "../../../backend/src/modules/auth/onboarding/use-cases/attach-tenant-onboarding.usecase.js";
import { PasswordResetRepository } from "../../../backend/src/modules/auth/password-reset/password-reset.repository.js";
import { ResetPasswordUseCase } from "../../../backend/src/modules/auth/password-reset/use-cases/reset-password.usecase.js";
import { UserRepository } from "../../../backend/src/modules/auth/user/user.repository.js";
import { makePrisma } from "./harness/db.js";
import { ownerDb } from "./harness/fixtures.js";

const CALLS = 10;
const app = makePrisma("app");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newUser = () =>
  ownerDb().user.create({ data: { email: `audit-${randomUUID()}@exemplo.test`, password: "x", emailVerifiedAt: new Date() } });

const reset = new ResetPasswordUseCase(
  new PasswordResetRepository(),
  new UserRepository(),
  { hash: async (p: string) => (await sleep(100), `hash:${p}`), authFailureDelay: async () => {} } as never,
  { isLoginLocked: () => false } as never,
  {} as never,
  { execute: async () => {} } as never,
  { hashPasswordResetToken: (t: string) => t } as never,
);
const onboarding = new AttachTenantOnboardingUseCase(
  new OnboardingRepository(),
  { execute: async () => ({}) } as never,
  { requireEmailVerification: false } as never,
);

let resetBad = 0;
let onboardBad = 0;
for (let round = 1; round <= 5; round++) {
  const u = await newUser();
  const token = `tok-${randomUUID()}-${randomUUID()}`;
  await ownerDb().passwordResetToken.create({ data: { userId: u.id, tokenHash: token, expiresAt: new Date(Date.now() + 3_600_000) } as never });
  const r = await Promise.allSettled(
    Array.from({ length: CALLS }, (_, i) => runWithDbContext(app, {}, () => reset.execute({ token, password: `Senha-${i}` } as never))),
  );
  const okReset = r.filter((x) => x.status === "fulfilled").length;
  if (okReset > 1) resetBad++;

  const u2 = await newUser();
  const base = String(Date.now()).slice(-8);
  const o = await Promise.allSettled(
    Array.from({ length: CALLS }, (_, i) =>
      runWithDbContext(app, {}, () =>
        onboarding.execute({
          userId: u2.id,
          tenantData: {
            razaoSocial: `Onb ${i}`, nomeFantasia: `O${i}`, cnpj: `${base}${String(round)}${String(i).padStart(5, "0")}`.slice(0, 14),
            ie: "1", logradouro: "R", bairro: "B", codigoMunicipio: "3550308", municipio: "SP", uf: "SP", cep: "01001000", ambiente: "HOMOLOGACAO",
          },
        }),
      ),
    ),
  );
  const okOnb = o.filter((x) => x.status === "fulfilled").length;
  const tenants = await ownerDb().tenant.count({ where: { cnpj: { startsWith: `${base}${round}` } } });
  if (tenants > 1) onboardBad++;
  console.log(`rodada ${round}: AUTH-1 redefinições aceitas com o mesmo token=${okReset}/${CALLS}; AUTH-7 onboardings aceitos=${okOnb}/${CALLS}, empresas criadas=${tenants}`);
}
console.log(`VEREDITO AUTH-1: ${resetBad > 0 ? `Confirmado (${resetBad}/5)` : "Refutado (5/5 limpas)"}`);
console.log(`VEREDITO AUTH-7: ${onboardBad > 0 ? `Confirmado (${onboardBad}/5)` : "Refutado (5/5 limpas)"}`);
await app.$disconnect();
await ownerDb().$disconnect();
