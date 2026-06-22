import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { isEmailVerified, twoFactorPendingTtl } from "../../../../lib/auth/config.js";
import type { TwoFactorPendingPayload } from "../../../../lib/auth/types/index.js";
import { verifyTurnstileToken } from "../../../../lib/auth/turnstile.js";
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
} from "../schemas/auth.schemas.js";
import type { AccessTokenPayload } from "../../domain/entities/auth-session.entity.js";
import { createAuthModule } from "../../infrastructure/factory/auth-module.factory.js";
import { wrapRouteWithDbContext } from "../../../../lib/db/wrap-protected-route.js";
import { buildAuthMeta, signAccessToken } from "../helpers/auth-request.helper.js";
import { handleAuthError } from "../mappers/auth-error.handler.js";
import { onboardingController } from "./onboarding.controller.js";

/** Assina JWT temporário `2fa_pending` com TTL configurável. */
function signTwoFactorPendingToken(
  signJwt: (payload: TwoFactorPendingPayload, options: { expiresIn: string }) => string,
) {
  return (payload: TwoFactorPendingPayload) =>
    signJwt(payload, { expiresIn: twoFactorPendingTtl() });
}

/**
 * Controller HTTP de autenticação e gestão de sessão.
 *
 * Regista rotas sob `/auth`. Valida entrada com Zod, aplica rate-limit por rota,
 * Turnstile no registo e traduz erros de domínio via `handleAuthError`.
 * O sub-plugin `onboardingController` trata o vínculo inicial empresa ↔ utilizador.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | POST | `/auth/register` | RegisterUserUseCase |
 * | POST | `/auth/login` | LoginUseCase |
 * | POST | `/auth/login/verify-2fa` | VerifyTwoFactorLoginUseCase |
 * | POST | `/auth/refresh` | RefreshSessionUseCase |
 * | POST | `/auth/logout` | LogoutUseCase |
 * | GET | `/auth/me` | GetCurrentUserUseCase |
 * | POST | `/auth/forgot-password` | RequestPasswordResetUseCase |
 * | POST | `/auth/reset-password` | ResetPasswordUseCase |
 * | POST | `/auth/verify-email` | VerifyEmailUseCase |
 * | POST | `/auth/resend-verification` | ResendVerificationEmailUseCase |
 * | GET | `/auth/2fa/status` | GetTwoFactorStatusUseCase |
 * | POST | `/auth/2fa/setup` | SetupTwoFactorUseCase |
 * | POST | `/auth/2fa/enable` | EnableTwoFactorUseCase |
 * | POST | `/auth/2fa/disable` | DisableTwoFactorUseCase |
 */
export const authController: FastifyPluginAsync = async (app) => {
  await app.register(rateLimit, {
    global: false,
    ban: 0,
  });

  app.addHook("onRoute", (routeOptions) => {
    wrapRouteWithDbContext(app, routeOptions, (request) => ({
      userId: request.user?.userId,
      tenantId: request.user?.tenantId ?? undefined,
    }));
  });

  const auth = createAuthModule();
  const signAccess = signAccessToken(app);
  const signTwoFactorPending = signTwoFactorPendingToken((payload, options) =>
    (app.jwt.sign as unknown as (p: TwoFactorPendingPayload, o: { expiresIn: string }) => string)(
      payload,
      options,
    ),
  );

  await app.register(onboardingController, { auth, signAccess });

  const twoFaRateLimit = { max: 5, timeWindow: "15 minutes" } as const;

  app.post(
    "/auth/register",
    { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (request, reply) => {
      try {
        const body = registerBodySchema.parse(request.body);
        await verifyTurnstileToken(body.captchaToken, request.ip);
        const session = await auth.registerUser.execute(body, signAccess, buildAuthMeta(request));
        return reply.status(201).send(session);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );

  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      try {
        const body = loginBodySchema.parse(request.body);
        await verifyTurnstileToken(body.captchaToken, request.ip);
        const result = await auth.login.execute(
          { email: body.email, password: body.password },
          signAccess,
          buildAuthMeta(request),
          signTwoFactorPending,
        );
        return result;
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );

  app.post(
    "/auth/forgot-password",
    { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (request, reply) => {
      try {
        const body = forgotPasswordBodySchema.parse(request.body);
        const result = await auth.requestPasswordReset.execute(body);
        return reply.status(200).send(result);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );

  app.post(
    "/auth/reset-password",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      try {
        const body = resetPasswordBodySchema.parse(request.body);
        const result = await auth.resetPassword.execute(body);
        return reply.status(200).send(result);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );

  app.post(
    "/auth/login/verify-2fa",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      try {
        const body = verify2faBodySchema.parse(request.body);
        const session = await auth.verifyTwoFactorLogin.execute(
          body,
          buildAuthMeta(request),
          signAccess,
          (token) => request.server.jwt.verify<TwoFactorPendingPayload>(token),
        );
        return session;
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );

  app.get("/auth/2fa/status", { onRequest: [app.authenticate] }, async (request) => {
    return auth.getTwoFactorStatus.execute(request.user.userId);
  });

  app.post(
    "/auth/2fa/setup",
    { onRequest: [app.authenticate], config: { rateLimit: twoFaRateLimit } },
    async (request, reply) => {
      try {
        return await auth.setupTwoFactor.execute(request.user.userId);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );

  app.post(
    "/auth/2fa/enable",
    { onRequest: [app.authenticate], config: { rateLimit: twoFaRateLimit } },
    async (request, reply) => {
      try {
        const { code } = enable2faBodySchema.parse(request.body);
        return await auth.enableTwoFactor.execute(request.user.userId, code);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );

  app.post(
    "/auth/2fa/disable",
    { onRequest: [app.authenticate], config: { rateLimit: twoFaRateLimit } },
    async (request, reply) => {
      try {
        const { password, code } = disable2faBodySchema.parse(request.body);
        return await auth.disableTwoFactor.execute(request.user.userId, password, code);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );

  app.post(
    "/auth/refresh",
    { config: { rateLimit: { max: 30, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      try {
        const { refreshToken } = refreshBodySchema.parse(request.body);
        const session = await auth.refreshSession.execute(
          refreshToken,
          signAccess,
          buildAuthMeta(request),
        );
        return session;
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );

  app.post(
    "/auth/logout",
    { config: { rateLimit: { max: 20, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      try {
        const body = logoutBodySchema.safeParse(request.body ?? {});
        const refreshToken = body.success ? body.data.refreshToken : undefined;

        let userId: string | undefined;
        try {
          await request.jwtVerify<AccessTokenPayload>();
          if (request.user.typ === "access") {
            userId = request.user.userId;
          }
        } catch {
          /* logout with refresh token only */
        }

        await auth.logout.execute(refreshToken, userId);
        return reply.status(204).send();
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );

  app.get("/auth/me", { onRequest: [app.authenticate] }, async (request, reply) => {
    const result = await auth.getCurrentUser.execute(request.user.userId);
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
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      try {
        const { token } = verifyEmailBodySchema.parse(request.body);
        const result = await auth.verifyEmail.execute(token);
        return reply.status(200).send(result);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );

  app.post(
    "/auth/resend-verification",
    { onRequest: [app.authenticate], config: { rateLimit: { max: 5, timeWindow: "1 hour" } } },
    async (request, reply) => {
      try {
        const result = await auth.resendVerificationEmail.execute(request.user.userId);
        return reply.status(200).send(result);
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );
};
