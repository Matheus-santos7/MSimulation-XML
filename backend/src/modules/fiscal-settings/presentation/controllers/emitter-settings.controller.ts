import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { handleRouteError } from "../../../../lib/http/domain-errors.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { createFiscalSettingsModule } from "../../infrastructure/factory/fiscal-settings-module.factory.js";
import { updateEmitterSettingsBodySchema } from "../schemas/emitter-settings.schemas.js";

/**
 * Controller HTTP de configurações do emissor fiscal.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/fiscal-settings` | GetEmitterSettingsUseCase |
 * | PATCH | `/fiscal-settings` | UpdateEmitterSettingsUseCase |
 */
export const emitterSettingsController: FastifyPluginAsync = async (app) => {
  const fiscalSettings = () => createFiscalSettingsModule(getDbClient());

  app.get("/fiscal-settings", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const view = await fiscalSettings().getEmitterSettings.execute(tenantId);
    if (!view) return reply.status(404).send({ error: "Empresa não encontrada" });
    return view;
  });

  app.patch("/fiscal-settings", async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const body = updateEmitterSettingsBodySchema.parse(req.body);
      const view = await fiscalSettings().updateEmitterSettings.execute(tenantId, body);
      if (!view) return reply.status(404).send({ error: "Empresa não encontrada" });
      return view;
    } catch (error) {
      if (handleRouteError(reply, error, {})) return;
      throw error;
    }
  });
};

/** @deprecated Use emitterSettingsController */
export const fiscalSettingsRoutes = emitterSettingsController;
