import type { FastifyInstance } from "fastify";
import { tenantIdFromRequest } from "../../lib/auth/request-context.js";
import { requireAdminHook } from "../../plugins/contexts/guards.js";
import { unidadeIdParam, unidadesListQuery } from "../../schemas/logistics/unidades-logisticas.js";
import { UnidadeLogisticaError, UnidadeLogisticaService } from "../../services/logistics/unidade-logistica-service.js";
import { resolveBulkImportPayload } from "./bulk-import.helpers.js";

export function registerUnidadesRoutes(app: FastifyInstance) {
  app.get("/unidades-logisticas", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const q = unidadesListQuery.parse(req.query);
    const service = new UnidadeLogisticaService(app.prisma);
    const ativa = q.ativa === "false" ? false : q.ativa === "true" ? true : undefined;
    return service.list(tenantId, { ativa, q: q.q, cnpj: q.cnpj });
  });

  app.get("/unidades-logisticas/:id", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { id } = unidadeIdParam.parse(req.params);
    const service = new UnidadeLogisticaService(app.prisma);
    const row = await service.getById(tenantId, id);
    if (!row) return reply.status(404).send({ error: "Unidade não encontrada" });
    return row;
  });

  app.post("/unidades-logisticas/bulk-import", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const payload = await resolveBulkImportPayload(req);
    if (!payload.ok) {
      return reply.status(payload.status).send({
        error: payload.error,
        ...(payload.details !== undefined ? { details: payload.details } : {}),
      });
    }

    try {
      const service = new UnidadeLogisticaService(app.prisma);
      const result = await service.bulkImport(tenantId, payload.rows, payload.enrichCep);
      return {
        ...result,
        ...(payload.parseErrors.length > 0 ? { parseErrors: payload.parseErrors } : {}),
      };
    } catch (e) {
      if (e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.patch("/unidades-logisticas/:id/padrao", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { id } = unidadeIdParam.parse(req.params);
    try {
      const service = new UnidadeLogisticaService(app.prisma);
      return await service.setPadrao(tenantId, id);
    } catch (e) {
      if (e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });
}
