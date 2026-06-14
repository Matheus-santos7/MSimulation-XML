import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { aplicarPapelEmitenteTenant } from "../../../../lib/org/emitente-fiscal-papeis.js";
import { handleRouteError } from "../../../../lib/http/domain-errors.js";
import { TenantConflictError } from "../../domain/errors/tenant-conflict.error.js";
import { createOrgModule } from "../../infrastructure/factory/org-module.factory.js";
import { tenantIdParam, tenantUpdateBody } from "../schemas/tenant.schemas.js";

/** Mapeamento de erros de tenant para HTTP. */
const TENANT_ERROR_MAPPINGS = [{ type: TenantConflictError, status: 409 }] as const;

/**
 * Controller HTTP de gestão da empresa emitente (tenant).
 *
 * Segurança: o utilizador só acede ao **próprio** tenant do JWT (`tenantIdFromRequest`).
 * Pedidos a outro `:id` devolvem 404. Criação e exclusão estão bloqueadas na API
 * (onboarding via `auth`; exclusão não permitida).
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/tenants` | GetTenantByIdUseCase (array com 1 item) |
 * | GET | `/tenants/:id` | GetTenantByIdUseCase |
 * | POST | `/tenants` | 403 — usar onboarding auth |
 * | PATCH | `/tenants/:id` | UpdateTenantUseCase |
 * | DELETE | `/tenants/:id` | 403 — exclusão não permitida |
 */
export const tenantController: FastifyPluginAsync = async (app) => {
  const org = createOrgModule();

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
      if (body.emitenteFiscalPrincipal === true || body.emitenteFiscalMatriz === true) {
        await aplicarPapelEmitenteTenant(getDbClient(), id, {
          emitenteFiscalPrincipal: body.emitenteFiscalPrincipal,
          emitenteFiscalMatriz: body.emitenteFiscalMatriz,
        });
      }
      if (!tenant) return reply.status(404).send({ error: "Empresa não encontrada" });
      return org.getTenantById.execute(id);
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
