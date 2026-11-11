/**
 * S-4: o login com senha correta zera o contador (login.usecase.ts: clearLoginLockout antes do
 * ramo de 2FA). O atacante com a senha alterna 4 códigos errados e um novo login.
 * Use case de 2FA, UserRepository e LoginLockoutProvider reais; o JWT 2fa_pending é falso.
 * Replay: o mesmo código TOTP válido duas vezes na mesma janela.
 */
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { runWithDbContext } from "../../../backend/src/lib/db/tenant-rls.js";
import { generateTotpSecret, verifyTotpCode } from "../../../backend/src/lib/auth/totp.js";
import { LoginLockoutProvider } from "../../../backend/src/modules/auth/providers/login-lockout.provider.js";
import { VerifyTwoFactorLoginUseCase } from "../../../backend/src/modules/auth/two-factor/use-cases/verify-two-factor-login.usecase.js";
import { UserRepository } from "../../../backend/src/modules/auth/user/user.repository.js";
import { makePrisma } from "./harness/db.js";
import { ownerDb } from "./harness/fixtures.js";

const req = createRequire(new URL("../../../backend/package.json", import.meta.url));
const { generate } = req("otplib") as { generate: (o: { secret: string }) => Promise<string> };

const MAX = 5; // padrão de LOGIN_MAX_FAILED_ATTEMPTS (lib/auth/config.ts)
const app = makePrisma("app");
const secret = generateTotpSecret();
const user = await ownerDb().user.create({
  data: { email: `s4-${randomUUID()}@exemplo.test`, password: "x", totpEnabledAt: new Date(), totpSecretEnc: "enc" },
});
const users = new UserRepository();
const uc = new VerifyTwoFactorLoginUseCase(
  users,
  new LoginLockoutProvider({ loginMaxFailedAttempts: MAX, loginLockoutMs: 15 * 60_000 } as never),
  { decryptSecret: () => secret, verifyCode: verifyTotpCode } as never,
  { verifyTwoFactorPending: () => ({ typ: "2fa_pending", userId: user.id, tokenVersion: 0 }) } as never,
  { execute: async () => ({ ok: true }) } as never,
);
const inCtx = <T>(fn: () => Promise<T>) => runWithDbContext(app, {}, fn);

let wrong = 0;
let locked = false;
for (let cycle = 0; cycle < 25 && !locked; cycle++) {
  await inCtx(() => users.clearLoginLockout(user.id)); // = login com a senha correta (login.usecase.ts:56)
  for (let i = 0; i < MAX - 1; i++) {
    try {
      await inCtx(() => uc.execute({ twoFactorToken: "t", code: "000000" }, {}));
    } catch (e) {
      if ((e as Error).constructor.name.includes("TooMany")) { locked = true; break; }
      wrong++;
    }
  }
}
console.log(`códigos errados testados sem bloqueio: ${wrong} (limite configurado: ${MAX}); bloqueado=${locked}`);

const code = await generate({ secret });
await inCtx(() => users.clearLoginLockout(user.id));
const first = await inCtx(() => uc.execute({ twoFactorToken: "t", code }, {})).then(() => true, () => false);
const second = await inCtx(() => uc.execute({ twoFactorToken: "t", code }, {})).then(() => true, () => false);
console.log(`replay do mesmo código TOTP: 1ª=${first}, 2ª=${second}`);
console.log(`VEREDITO: ${wrong > MAX && !locked ? "Confirmado (força bruta)" : "Refutado (força bruta)"}; ${first && second ? "Confirmado (replay)" : "Refutado (replay)"}`);
await app.$disconnect();
await ownerDb().$disconnect();
