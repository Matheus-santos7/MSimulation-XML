import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { twoFactorPendingTtl } from "../../lib/auth/config.js";
import type { AccessTokenPayload, TwoFactorPendingPayload } from "../../lib/auth/jwt-payload.js";
import {
  disable2faBodySchema,
  enable2faBodySchema,
  forgotPasswordBodySchema,
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  verify2faBodySchema,
  verifyEmailBodySchema,
} from "../../schemas/auth/schemas.js";
import { tenantCreateBody } from "../../schemas/tenant.js";
import {
  AuthConflictError,
  AuthService,
  AuthStateError,
  AuthTooManyRequestsError,
  AuthUnauthorizedError,
} from "../../services/auth/auth-service.js";
import { TwoFactorRequiredError, TwoFactorService } from "../../services/auth/two-factor-service.js";
import { TenantConflictError } from "../../services/tenant-service.js";
import {
  PasswordResetInvalidError,
  PasswordResetService,
} from "../../services/auth/password-reset-service.js";
import { EmailDeliveryError } from "../../services/auth/email-service.js";
import {
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailableError,
} from "../../lib/db/errors.js";
import { userIdFromRequest } from "../../lib/auth/request-context.js";
import { CaptchaVerificationError, verifyTurnstileToken } from "../../lib/auth/turnstile.js";
import {
  EmailVerificationInvalidError,
  EmailVerificationService,
} from "../../services/auth/email-verification-service.js";

function authMeta(req: FastifyRequest) {
  return {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
  };
}

function signAccess(app: { jwt: { sign: (p: AccessTokenPayload, o?: { expiresIn: string }) => string } }) {
  return (payload: AccessTokenPayload) => app.jwt.sign(payload);
}

function signTwoFactorPending(
  signJwt: (payload: TwoFactorPendingPayload, options: { expiresIn: string }) => string,
) {
  return (payload: TwoFactorPendingPayload) =>
    signJwt(payload, { expiresIn: twoFactorPendingTtl() });
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  await app.register(rateLimit, {
    global: false,
    ban: 0,
  });

  const service = new AuthService(app.prisma);
  const passwordReset = new PasswordResetService(app.prisma);
  const sign = signAccess(app);
  const sign2fa = signTwoFactorPending((payload, options) =>
    (app.jwt.sign as unknown as (p: TwoFactorPendingPayload, o: { expiresIn: string }) => string)(
      payload,
      options,
    ),
  );
  const twoFactor = new TwoFactorService(app.prisma, service, sign, sign2fa);
  const emailVerification = new EmailVerificationService(app.prisma);

  const twoFaRateLimit = { max: 5, timeWindow: "15 minutes" } as const;

  app.post(
    "/auth/register",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "1 hour" },
      },
    },
    async (req, reply) => {
      try {
        const body = registerBodySchema.parse(req.body);
        await verifyTurnstileToken(body.captchaToken, req.ip);
        const session = await service.register(body, sign, authMeta(req));
        return reply.status(201).send(session);
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );

  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
    },
    async (req, reply) => {
      try {
        const { email, password } = loginBodySchema.parse(req.body);
        const result = await service.login(email, password, sign, authMeta(req), sign2fa);
        return result;
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );

  app.post(
    "/auth/forgot-password",
    {
      config: {
        rateLimit: { max: 5, timeWindow: "1 hour" },
      },
    },
    async (req, reply) => {
      try {
        const body = forgotPasswordBodySchema.parse(req.body);
        const result = await passwordReset.requestReset(body);
        return reply.status(200).send(result);
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );

  app.post(
    "/auth/reset-password",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
    },
    async (req, reply) => {
      try {
        const body = resetPasswordBodySchema.parse(req.body);
        const result = await passwordReset.resetPassword(body);
        return reply.status(200).send(result);
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );

  app.post(
    "/auth/login/verify-2fa",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
    },
    async (req, reply) => {
      try {
        const body = verify2faBodySchema.parse(req.body);
        const session = await twoFactor.verifyLogin(
          body.twoFactorToken,
          body.code,
          authMeta(req),
          (token) => req.server.jwt.verify<TwoFactorPendingPayload>(token),
        );
        return session;
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );

  app.get("/auth/2fa/status", { onRequest: [app.authenticate] }, async (req) => {
    return twoFactor.getStatus(req.user.userId);
  });

  app.post(
    "/auth/2fa/setup",
    { onRequest: [app.authenticate], config: { rateLimit: twoFaRateLimit } },
    async (req, reply) => {
    try {
      return await twoFactor.setup(req.user.userId);
    } catch (e) {
      return handleAuthError(e, reply);
    }
  });

  app.post(
    "/auth/2fa/enable",
    { onRequest: [app.authenticate], config: { rateLimit: twoFaRateLimit } },
    async (req, reply) => {
    try {
      const { code } = enable2faBodySchema.parse(req.body);
      return await twoFactor.enable(req.user.userId, code);
    } catch (e) {
      return handleAuthError(e, reply);
    }
  });

  app.post(
    "/auth/2fa/disable",
    { onRequest: [app.authenticate], config: { rateLimit: twoFaRateLimit } },
    async (req, reply) => {
      try {
        const { password, code } = disable2faBodySchema.parse(req.body);
        return await twoFactor.disable(req.user.userId, password, code);
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );

  app.post(
    "/auth/refresh",
    {
      config: {
        rateLimit: { max: 30, timeWindow: "15 minutes" },
      },
    },
    async (req, reply) => {
      try {
        const { refreshToken } = refreshBodySchema.parse(req.body);
        const session = await service.refresh(refreshToken, sign, authMeta(req));
        return session;
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );

  app.post(
    "/auth/logout",
    {
      config: {
        rateLimit: { max: 20, timeWindow: "15 minutes" },
      },
    },
    async (req, reply) => {
      try {
        const body = logoutBodySchema.safeParse(req.body ?? {});
        const refreshToken = body.success ? body.data.refreshToken : undefined;

        let userId: string | undefined;
        try {
          await req.jwtVerify<AccessTokenPayload>();
          if (req.user.typ === "access") {
            userId = req.user.userId;
          }
        } catch {
          /* logout só com refresh token */
        }

        await service.logout(refreshToken, userId);
        return reply.status(204).send();
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );

  app.get("/auth/me", { onRequest: [app.authenticate] }, async (req, reply) => {
    const result = await service.getMe(req.user.userId);
    if (!result) {
      return reply.status(404).send({ error: "Usuário não encontrado" });
    }
    return {
      userId: result.user.id,
      tenantId: result.user.tenantId,
      email: result.user.email,
      name: result.user.name ?? undefined,
      tenant: result.tenant,
      needsOnboarding: result.user.tenantId === null,
      twoFactorEnabled: result.user.totpEnabledAt != null,
      emailVerified: result.user.emailVerifiedAt != null,
      role: result.user.role,
    };
  });

  app.post(
    "/auth/verify-email",
    {
      config: {
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
    },
    async (req, reply) => {
      try {
        const { token } = verifyEmailBodySchema.parse(req.body);
        const result = await emailVerification.verifyEmail(token);
        return reply.status(200).send(result);
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );

  app.post(
    "/auth/resend-verification",
    { onRequest: [app.authenticate], config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (req, reply) => {
      try {
        const result = await emailVerification.resendForUser(req.user.userId);
        return reply.status(200).send(result);
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );

  app.post(
    "/auth/onboarding/tenant",
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      try {
        if (req.user.tenantId) {
          return reply.status(400).send({ error: "Empresa já cadastrada nesta conta" });
        }
        const body = tenantCreateBody.parse(req.body);
        const userId = userIdFromRequest(req);
        const session = await service.attachTenant(userId, body, sign, authMeta(req));
        return session;
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );
};

function handleAuthError(e: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
  if (e instanceof ZodError) {
    const fieldErrors = e.flatten().fieldErrors as Record<string, string[]>;
    const first = Object.values(fieldErrors).flat()[0];
    return reply.status(400).send({
      error: first ?? "Dados inválidos",
      details: fieldErrors,
    });
  }
  if (e instanceof AuthUnauthorizedError) {
    return reply.status(401).send({ error: e.message });
  }
  if (e instanceof AuthTooManyRequestsError) {
    return reply.status(429).send({ error: e.message });
  }
  if (e instanceof TwoFactorRequiredError) {
    return reply.status(401).send({ error: e.message });
  }
  if (e instanceof AuthConflictError) {
    return reply.status(409).send({ error: e.message });
  }
  if (e instanceof AuthStateError) {
    return reply.status(400).send({ error: e.message });
  }
  if (e instanceof TenantConflictError) {
    return reply.status(409).send({ error: e.message });
  }
  if (e instanceof PasswordResetInvalidError) {
    return reply.status(400).send({ error: e.message });
  }
  if (e instanceof EmailDeliveryError) {
    return reply.status(503).send({ error: "Não foi possível enviar o e-mail. Tente novamente em instantes." });
  }
  if (e instanceof CaptchaVerificationError) {
    return reply.status(400).send({ error: e.message });
  }
  if (e instanceof EmailVerificationInvalidError) {
    return reply.status(400).send({ error: e.message });
  }
  if (isDatabaseUnavailableError(e)) {
    return reply.status(503).send({ error: DATABASE_UNAVAILABLE_MESSAGE });
  }
  return reply.status(500).send({
    error: "Não foi possível completar a operação. Tente novamente em instantes.",
  });
}
