import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../lib/auth/request-context.js";
import { handleRouteError } from "../lib/http/domain-errors.js";
import { fiscalEmitterSettingsPatchBody } from "../schemas/fiscal-emitter-settings.js";
import { FiscalEmitterSettingsService } from "../services/fiscal-emitter-settings-service.js";

export const fiscalSettingsRoutes: FastifyPluginAsync = async (app) => {
  const service = new FiscalEmitterSettingsService(app.prisma);

  app.get("/fiscal-settings", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const view = await service.getView(tenantId);
    if (!view) return reply.status(404).send({ error: "Empresa não encontrada" });
    return view;
  });

  app.patch("/fiscal-settings", async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const body = fiscalEmitterSettingsPatchBody.parse(req.body);
      const view = await service.patch(tenantId, body);
      if (!view) return reply.status(404).send({ error: "Empresa não encontrada" });
      return view;
    } catch (e) {
      if (handleRouteError(reply, e, {})) return;
      throw e;
    }
  });
};
