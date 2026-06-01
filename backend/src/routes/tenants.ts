import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { tenantIdFromRequest } from "../lib/auth/request-context.js";
import { tenantIdParam, tenantUpdateBody } from "../schemas/tenant.js";
import { TenantConflictError, TenantService } from "../services/tenant-service.js";

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
      return handleTenantError(e, reply);
    }
  });

  app.delete("/tenants/:id", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { id } = tenantIdParam.parse(req.params);
    if (id !== tid) return reply.status(404).send({ error: "Empresa não encontrada" });
    return reply.status(403).send({ error: "Exclusão de empresa não permitida" });
  });
};

function handleTenantError(e: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
  if (e instanceof ZodError) {
    const fieldErrors = e.flatten().fieldErrors as Record<string, string[]>;
    const first = Object.values(fieldErrors).flat()[0];
    return reply.status(400).send({
      error: first ?? "Dados inválidos",
      details: fieldErrors,
    });
  }
  if (e instanceof TenantConflictError) {
    return reply.status(409).send({ error: e.message });
  }
  throw e;
}
