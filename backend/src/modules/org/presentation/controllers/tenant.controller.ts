import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { handleRouteError } from "../../../../lib/http/domain-errors.js";
import { TenantConflictError } from "../../domain/errors/tenant-conflict.error.js";
import { createOrgModule } from "../../infrastructure/factory/org-module.factory.js";
import { tenantIdParam, tenantUpdateBody } from "../schemas/tenant.schemas.js";

const TENANT_ERROR_MAPPINGS = [{ type: TenantConflictError, status: 409 }] as const;

export const tenantController: FastifyPluginAsync = async (app) => {
  const org = createOrgModule(app.prisma);

  /** Returns only the JWT tenant (compatible with UI expecting an array). */
  app.get("/tenants", async (request) => {
    const tenantId = tenantIdFromRequest(request);
    const tenant = await org.getTenantById.execute(tenantId);
    return tenant ? [tenant] : [];
  });

  app.get("/tenants/:id", async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id } = tenantIdParam.parse(request.params);
    if (id !== tenantId) return reply.status(404).send({ error: "Empresa não encontrada" });
    const tenant = await org.getTenantById.execute(id);
    if (!tenant) return reply.status(404).send({ error: "Empresa não encontrada" });
    return tenant;
  });

  app.post("/tenants", async (_request, reply) => {
    return reply.status(403).send({ error: "Cadastro de empresas não disponível via API autenticada" });
  });

  app.patch("/tenants/:id", async (request, reply) => {
    try {
      const tenantId = tenantIdFromRequest(request);
      const { id } = tenantIdParam.parse(request.params);
      if (id !== tenantId) return reply.status(404).send({ error: "Empresa não encontrada" });
      const body = tenantUpdateBody.parse(request.body);
      const tenant = await org.updateTenant.execute(id, body);
      if (!tenant) return reply.status(404).send({ error: "Empresa não encontrada" });
      return tenant;
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...TENANT_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.delete("/tenants/:id", async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id } = tenantIdParam.parse(request.params);
    if (id !== tenantId) return reply.status(404).send({ error: "Empresa não encontrada" });
    return reply.status(403).send({ error: "Exclusão de empresa não permitida" });
  });
};
