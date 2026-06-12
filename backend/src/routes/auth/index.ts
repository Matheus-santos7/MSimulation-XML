import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { isEmailVerified, twoFactorPendingTtl } from "../../lib/auth/config.js";
import type { AccessTokenPayload, TwoFactorPendingPayload } from "../../lib/auth/types/index.js";
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
import {
  AuthService,
  EmailVerificationService,
  OnboardingService,
  PasswordResetService,
  TwoFactorService,
} from "../../services/auth/index.js";
import { verifyTurnstileToken } from "../../lib/auth/turnstile.js";
import { handleAuthError } from "./auth-errors.js";
import { authMeta, signAccess } from "./helpers.js";
import { onboardingRoutes } from "./onboarding.routes.js";

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
  const onboarding = new OnboardingService(app.prisma, service);
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

  await app.register(onboardingRoutes, { onboarding, sign });

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
      emailVerified: isEmailVerified(result.user.emailVerifiedAt),
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
};
