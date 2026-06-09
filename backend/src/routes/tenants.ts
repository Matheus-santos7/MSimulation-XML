import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../lib/auth/request-context.js";
import { handleRouteError } from "../lib/http/domain-errors.js";
import { tenantIdParam, tenantUpdateBody } from "../schemas/tenant.js";
import { TenantConflictError, TenantService } from "../services/tenant-service.js";

const TENANT_ERROR_MAPPINGS = [{ type: TenantConflictError, status: 409 }] as const;

export const tenantRoutes: FastifyPluginAsync = async (app) => {
  const service = new TenantService(app.prisma);

  /** Retorna apenas o tenant do JWT (compatível com UI que espera array). */
  app.get("/tenants", async (req) => {
    const tid = tenantIdFromRequest(req);
    const tenant = await service.getById(tid);
    return tenant ? [tenant] : [];
  });

  app.get("/tenants/:id", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { id } = tenantIdParam.parse(req.params);
    if (id !== tid) return reply.status(404).send({ error: "Empresa não encontrada" });
    const tenant = await service.getById(id);
    if (!tenant) return reply.status(404).send({ error: "Empresa não encontrada" });
    return tenant;
  });

  app.post("/tenants", async (_req, reply) => {
    return reply.status(403).send({ error: "Cadastro de empresas não disponível via API autenticada" });
  });

  app.patch("/tenants/:id", async (req, reply) => {
    try {
      const tid = tenantIdFromRequest(req);
      const { id } = tenantIdParam.parse(req.params);
      if (id !== tid) return reply.status(404).send({ error: "Empresa não encontrada" });
      const body = tenantUpdateBody.parse(req.body);
      const tenant = await service.update(id, body);
      if (!tenant) return reply.status(404).send({ error: "Empresa não encontrada" });
      return tenant;
    } catch (e) {
      if (handleRouteError(reply, e, { mappings: [...TENANT_ERROR_MAPPINGS] })) return;
      throw e;
    }
  });

  app.delete("/tenants/:id", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { id } = tenantIdParam.parse(req.params);
    if (id !== tid) return reply.status(404).send({ error: "Empresa não encontrada" });
    return reply.status(403).send({ error: "Exclusão de empresa não permitida" });
  });
};
