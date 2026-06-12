import type { FastifyPluginAsync } from "fastify";
import { userIdFromRequest } from "../../../../lib/auth/request-context.js";
import { tenantCreateBody } from "../../../org/index.js";
import type { AccessTokenPayload } from "../../domain/entities/auth-session.entity.js";
import type { createAuthModule } from "../../infrastructure/factory/auth-module.factory.js";
import { buildAuthMeta } from "../helpers/auth-request.helper.js";
import { handleAuthError } from "../mappers/auth-error.handler.js";

type OnboardingControllerOptions = {
  auth: ReturnType<typeof createAuthModule>;
  signAccess: (payload: AccessTokenPayload) => string;
};

/**
 * Controller de onboarding pós-registo: cria tenant e associa ao utilizador autenticado.
 *
 * Requer JWT válido e `tenantId === null`. Após sucesso, devolve nova sessão
 * com `tenantId` preenchido e role `ADMIN`.
 *
 * @route POST `/auth/onboarding/tenant` → {@link AttachTenantOnboardingUseCase}
 */
export const onboardingController: FastifyPluginAsync<OnboardingControllerOptions> = async (
  app,
  options,
) => {
  app.post(
    "/auth/onboarding/tenant",
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      try {
        if (request.user.tenantId) {
          return reply.status(400).send({ error: "Empresa já cadastrada nesta conta" });
        }
        const body = tenantCreateBody.parse(request.body);
        const userId = userIdFromRequest(request);
        const session = await options.auth.attachTenantOnboarding.execute(
          { userId, tenantData: body },
          options.signAccess,
          buildAuthMeta(request),
        );
        return session;
      } catch (error) {
        return handleAuthError(error, reply);
      }
    },
  );
};
