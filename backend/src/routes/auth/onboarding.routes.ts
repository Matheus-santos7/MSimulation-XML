import type { FastifyPluginAsync } from "fastify";
import { userIdFromRequest } from "../../lib/auth/request-context.js";
import type { AccessTokenPayload } from "../../lib/auth/types/index.js";
import { tenantCreateBody } from "../../schemas/org/tenant.js";
import type { OnboardingService } from "../../services/auth/onboarding/onboarding-service.js";
import { handleAuthError } from "./auth-errors.js";
import { authMeta } from "./helpers.js";

type OnboardingRouteOpts = {
  onboarding: OnboardingService;
  sign: (payload: AccessTokenPayload) => string;
};

export const onboardingRoutes: FastifyPluginAsync<OnboardingRouteOpts> = async (app, opts) => {
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
        const session = await opts.onboarding.attachTenant(userId, body, opts.sign, authMeta(req));
        return session;
      } catch (e) {
        return handleAuthError(e, reply);
      }
    },
  );
};
