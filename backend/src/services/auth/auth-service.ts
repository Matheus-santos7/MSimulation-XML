import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import {
  accessTokenTtl,
  AUTH_GENERIC_LOGIN_ERROR,
  refreshTokenTtlMs,
  requireEmailVerification,
  twoFactorPendingTtl,
} from "../../lib/auth/config.js";
import {
  authSessionResponse,
  buildAccessPayload,
  buildTwoFactorPendingPayload,
  twoFactorPendingResponse,
  type LoginResponse,
  type TwoFactorPendingPayload,
} from "../../lib/auth/jwt-payload.js";
import {
  clearedLockoutState,
  isLoginLocked,
  lockoutMessage,
  nextLockoutState,
} from "../../lib/auth/login-lockout.js";
import { mapTenant } from "../../lib/org/tenant-mapper.js";
import {
  authFailureDelay,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "../../lib/auth/password.js";
import { generateRefreshToken, hashRefreshToken } from "../../lib/auth/refresh-token.js";
import type { registerBodySchema } from "../../schemas/auth/schemas.js";
import type { tenantCreateBody } from "../../schemas/org/tenant.js";
import { TenantConflictError, TenantService } from "../org/tenant-service.js";
import { EmailVerificationService } from "./email-verification-service.js";
import type { z } from "zod";

type RegisterInput = z.infer<typeof registerBodySchema>;
type TenantCreateInput = z.infer<typeof tenantCreateBody>;

export type AuthMeta = { userAgent?: string; ipAddress?: string };

export class AuthConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConflictError";
  }
}

export class AuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthStateError";
  }
}

export class AuthUnauthorizedError extends Error {
  constructor(message = AUTH_GENERIC_LOGIN_ERROR) {
    super(message);
    this.name = "AuthUnauthorizedError";
  }
}

export class AuthTooManyRequestsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthTooManyRequestsError";
  }
}

export class AuthService {
  private readonly tenants: TenantService;
  private readonly emailVerification: EmailVerificationService;

  constructor(private readonly prisma: PrismaClient) {
    this.tenants = new TenantService(prisma);
    this.emailVerification = new EmailVerificationService(prisma);
  }

  async register(
    data: RegisterInput,
    signAccess: (payload: ReturnType<typeof buildAccessPayload>) => string,
    meta: AuthMeta = {},
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new AuthConflictError("E-mail já cadastrado");
    }

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name ?? null,
        password: await hashPassword(data.password),
        tenantId: undefined,
        role: "MEMBER",
        emailVerifiedAt: requireEmailVerification() ? null : new Date(),
      },
    });

    if (requireEmailVerification()) {
      try {
        await this.emailVerification.sendVerificationEmail(user.id);
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[dev] Falha ao enviar e-mail de verificação no registro:", e);
        }
      }
    }

    const refreshToken = await this.createSession(user.id, meta);
    return authSessionResponse(
      signAccess,
      accessTokenTtl(),
      refreshToken,
      user,
      null,
      user.tokenVersion,
    );
  }

  async login(
    email: string,
    password: string,
    signAccess: (payload: ReturnType<typeof buildAccessPayload>) => string,
    meta: AuthMeta = {},
    signTwoFactorPending?: (payload: TwoFactorPendingPayload) => string,
  ): Promise<LoginResponse> {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: { tenant: true },
    });

    if (user && isLoginLocked(user.lockedUntil)) {
      await authFailureDelay();
      throw new AuthTooManyRequestsError(lockoutMessage(user.lockedUntil!));
    }

    const storedHash = user?.password ?? DUMMY_PASSWORD_HASH;
    const valid = await verifyPassword(password, storedHash);

    if (!user || !valid) {
      if (user) {
        await this.recordFailedLogin(user.id, user.failedLoginAttempts);
      }
      await authFailureDelay();
      throw new AuthUnauthorizedError();
    }

    await this.clearLoginLockout(user.id);

    if (user.totpEnabledAt && signTwoFactorPending) {
      const token = signTwoFactorPending(buildTwoFactorPendingPayload(user));
      return twoFactorPendingResponse(token, twoFactorPendingTtl());
    }

    return this.finishLogin(user.id, meta, signAccess);
  }

  async finishLogin(
    userId: string,
    meta: AuthMeta,
    signAccess?: (payload: ReturnType<typeof buildAccessPayload>) => string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user) {
      throw new AuthUnauthorizedError();
    }

    const sign = signAccess ?? (() => {
      throw new Error("signAccess obrigatório");
    });

    const refreshToken = await this.createSession(user.id, meta);
    return authSessionResponse(
      sign,
      accessTokenTtl(),
      refreshToken,
      user,
      user.tenant ? mapTenant(user.tenant) : null,
      user.tokenVersion,
    );
  }

  async refresh(
    refreshToken: string,
    signAccess: (payload: ReturnType<typeof buildAccessPayload>) => string,
    meta: AuthMeta = {},
  ) {
    const session = await this.findActiveSession(refreshToken);
    if (!session) {
      await authFailureDelay();
      throw new AuthUnauthorizedError("Sessão expirada. Entre novamente.");
    }

    await this.revokeSessionById(session.id);

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      include: { tenant: true },
    });
    if (!user) {
      throw new AuthUnauthorizedError();
    }

    const newRefresh = await this.createSession(user.id, meta);
    return authSessionResponse(
      signAccess,
      accessTokenTtl(),
      newRefresh,
      user,
      user.tenant ? mapTenant(user.tenant) : null,
      user.tokenVersion,
    );
  }

  async logout(refreshToken?: string, userId?: string) {
    if (refreshToken) {
      await this.revokeSessionByToken(refreshToken);
    }
    if (userId) {
      await this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user) return null;

    return {
      user,
      tenant: user.tenant ? mapTenant(user.tenant) : null,
    };
  }

  async attachTenant(
    userId: string,
    data: TenantCreateInput,
    signAccess: (payload: ReturnType<typeof buildAccessPayload>) => string,
    meta: AuthMeta = {},
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthStateError("Usuário não encontrado");
    if (user.tenantId) throw new AuthStateError("Empresa já vinculada à conta");
    if (requireEmailVerification() && !user.emailVerifiedAt) {
      throw new AuthStateError("Confirme seu e-mail antes de cadastrar a empresa");
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const tenantRow = await tx.tenant.create({
          data: data as Prisma.TenantCreateInput,
        });
        const userRow = await tx.user.update({
          where: { id: userId },
          data: { tenantId: tenantRow.id, role: "ADMIN" },
          include: { tenant: true },
        });
        return { user: userRow, tenant: mapTenant(tenantRow) };
      });

      const refreshToken = await this.createSession(result.user.id, meta);
      return authSessionResponse(
        signAccess,
        accessTokenTtl(),
        refreshToken,
        result.user,
        result.tenant,
        result.user.tokenVersion,
      );
    } catch (e) {
      if (e instanceof TenantConflictError) throw e;
      if (isPrismaUniqueError(e)) {
        throw new TenantConflictError("CNPJ já cadastrado");
      }
      throw e;
    }
  }

  async invalidateAllSessions(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  private async createSession(userId: string, meta: AuthMeta): Promise<string> {
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + refreshTokenTtlMs());

    await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 512),
        ipAddress: meta.ipAddress?.slice(0, 64),
      },
    });

    return refreshToken;
  }

  private async findActiveSession(refreshToken: string) {
    const hash = hashRefreshToken(refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: hash },
    });
    if (!session || session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;
    return session;
  }

  private async revokeSessionByToken(refreshToken: string) {
    const hash = hashRefreshToken(refreshToken);
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeSessionById(sessionId: string) {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  private async recordFailedLogin(userId: string, currentAttempts: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: nextLockoutState(currentAttempts),
    });
  }

  private async clearLoginLockout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: clearedLockoutState(),
    });
  }
}

function isPrismaUniqueError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}
