import type { PrismaClient } from "../../generated/prisma/client.js";
import { TOTP_ISSUER, twoFactorPendingTtl } from "../../lib/auth/config.js";
import {
  buildTwoFactorPendingPayload,
  twoFactorPendingResponse,
  type TwoFactorPendingPayload,
} from "../../lib/auth/jwt-payload.js";
import { decryptTotpSecret, encryptTotpSecret } from "../../lib/auth/totp-crypto.js";
import { buildTotpUri, generateTotpSecret, verifyTotpCode } from "../../lib/auth/totp.js";
import { verifyPassword } from "../../lib/auth/password.js";
import {
  AuthService,
  AuthStateError,
  AuthUnauthorizedError,
  type AuthMeta,
} from "./auth-service.js";

export class TwoFactorRequiredError extends Error {
  constructor(message = "Código de autenticação inválido") {
    super(message);
    this.name = "TwoFactorRequiredError";
  }
}

export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly auth: AuthService,
    private readonly signAccess: (payload: import("../../lib/auth/jwt-payload.js").AccessTokenPayload) => string,
    private readonly signTwoFactorPending: (payload: TwoFactorPendingPayload) => string,
  ) {}

  async issuePendingChallenge(user: { id: string; tokenVersion: number }) {
    const token = this.signTwoFactorPending(buildTwoFactorPendingPayload(user));
    return twoFactorPendingResponse(token, twoFactorPendingTtl());
  }

  async verifyLogin(
    twoFactorToken: string,
    code: string,
    meta: AuthMeta,
    verifyJwt: (token: string) => TwoFactorPendingPayload,
  ) {
    let payload: TwoFactorPendingPayload;
    try {
      payload = verifyJwt(twoFactorToken);
    } catch {
      throw new TwoFactorRequiredError("Sessão de verificação expirada. Entre novamente.");
    }

    if (payload.typ !== "2fa_pending") {
      throw new TwoFactorRequiredError();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.tokenVersion !== payload.tokenVersion || !user.totpEnabledAt) {
      throw new TwoFactorRequiredError("Sessão de verificação expirada. Entre novamente.");
    }

    const secret = user.totpSecretEnc ? decryptTotpSecret(user.totpSecretEnc) : null;
    if (!secret || !(await verifyTotpCode(secret, code))) {
      throw new TwoFactorRequiredError();
    }

    return this.auth.finishLogin(user.id, meta, this.signAccess);
  }

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabledAt: true },
    });
    return { enabled: user?.totpEnabledAt != null };
  }

  async setup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthStateError("Usuário não encontrado");
    if (user.totpEnabledAt) {
      throw new AuthStateError("Autenticação em duas etapas já está ativa");
    }

    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEnc: encryptTotpSecret(secret) },
    });

    return {
      secret,
      otpauthUrl: buildTotpUri(user.email, secret),
      issuer: TOTP_ISSUER,
    };
  }

  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthStateError("Usuário não encontrado");
    if (user.totpEnabledAt) {
      throw new AuthStateError("Autenticação em duas etapas já está ativa");
    }

    const secret = user.totpSecretEnc ? decryptTotpSecret(user.totpSecretEnc) : null;
    if (!secret) {
      throw new AuthStateError("Inicie a configuração antes de ativar");
    }
    if (!(await verifyTotpCode(secret, code))) {
      throw new TwoFactorRequiredError();
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabledAt: new Date() },
    });

    return { enabled: true };
  }

  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthStateError("Usuário não encontrado");
    if (!user.totpEnabledAt) {
      throw new AuthStateError("Autenticação em duas etapas não está ativa");
    }

    const validPassword = await verifyPassword(password, user.password);
    if (!validPassword) {
      throw new AuthUnauthorizedError("Senha incorreta");
    }

    const secret = user.totpSecretEnc ? decryptTotpSecret(user.totpSecretEnc) : null;
    if (!secret || !(await verifyTotpCode(secret, code))) {
      throw new TwoFactorRequiredError();
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: null,
        totpEnabledAt: null,
      },
    });

    return { enabled: false };
  }
}
