import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import {
  fiscalEmitterSettingsPatchBody,
  fiscalSettingsTenantQuery,
} from "../schemas/fiscal-emitter-settings.js";
import { FiscalEmitterSettingsService } from "../services/fiscal-emitter-settings-service.js";

export const fiscalSettingsRoutes: FastifyPluginAsync = async (app) => {
  const service = new FiscalEmitterSettingsService(app.prisma);

  app.get("/fiscal-settings", async (req, reply) => {
    const { tenantId } = fiscalSettingsTenantQuery.parse(req.query);
    const view = await service.getView(tenantId);
    if (!view) return reply.status(404).send({ error: "Empresa não encontrada" });
    return view;
  });

  app.patch("/fiscal-settings", async (req, reply) => {
    try {
      const { tenantId } = fiscalSettingsTenantQuery.parse(req.query);
      const body = fiscalEmitterSettingsPatchBody.parse(req.body);
      const view = await service.patch(tenantId, body);
      if (!view) return reply.status(404).send({ error: "Empresa não encontrada" });
      return view;
    } catch (e) {
      if (e instanceof ZodError) {
        const fieldErrors = e.flatten().fieldErrors as Record<string, string[]>;
        const first = Object.values(fieldErrors).flat()[0];
        return reply.status(400).send({ error: first ?? "Dados inválidos", details: fieldErrors });
      }
      throw e;
    }
  });
};
