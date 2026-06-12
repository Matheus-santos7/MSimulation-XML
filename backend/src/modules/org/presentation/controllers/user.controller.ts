import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest, userIdFromRequest } from "../../../../lib/auth/request-context.js";
import { handleRouteError } from "../../../../lib/http/domain-errors.js";
import { requireAdminHook } from "../../../../plugins/contexts/guards.js";
import { UserConflictError } from "../../domain/errors/user-conflict.error.js";
import { UserForbiddenError } from "../../domain/errors/user-forbidden.error.js";
import { createOrgModule } from "../../infrastructure/factory/org-module.factory.js";
import { userCreateBody, userIdParam, userUpdateBody } from "../schemas/user.schemas.js";

/** Mapeamento de erros de utilizador para HTTP. */
const USER_ERROR_MAPPINGS = [
  { type: UserConflictError, status: 409 },
  { type: UserForbiddenError, status: 403 },
] as const;

/**
 * Controller HTTP de gestão de utilizadores do tenant.
 *
 * Listagem e leitura: qualquer membro autenticado.
 * Criação, edição e exclusão: exige `requireAdminHook` (role ADMIN no JWT).
 * Todas as queries filtram por `tenantId` do JWT (isolamento multi-tenant).
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/users` | ListUsersByTenantUseCase |
 * | GET | `/users/:id` | GetUserByIdUseCase |
 * | POST | `/users` | CreateUserUseCase (ADMIN) |
 * | PATCH | `/users/:id` | UpdateUserUseCase (ADMIN) |
 * | DELETE | `/users/:id` | DeleteUserUseCase (ADMIN) |
 */
export const userController: FastifyPluginAsync = async (app) => {
  const org = createOrgModule(app.prisma);

  app.get("/users", async (request) => {
    const tenantId = tenantIdFromRequest(request);
    return org.listUsersByTenant.execute(tenantId);
  });

  app.get("/users/:id", async (request, reply) => {
    const tenantId = tenantIdFromRequest(request);
    const { id } = userIdParam.parse(request.params);
    const user = await org.getUserById.execute(id, tenantId);
    if (!user) return reply.status(404).send({ error: "Usuário não encontrado" });
    return user;
  });

  app.post("/users", { onRequest: [requireAdminHook] }, async (request, reply) => {
    try {
      const tenantId = tenantIdFromRequest(request);
      const body = userCreateBody.parse(request.body);
      const user = await org.createUser.execute(tenantId, body);
      return reply.status(201).send(user);
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...USER_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.patch("/users/:id", { onRequest: [requireAdminHook] }, async (request, reply) => {
    try {
      const tenantId = tenantIdFromRequest(request);
      const { id } = userIdParam.parse(request.params);
      const body = userUpdateBody.parse(request.body);
      const user = await org.updateUser.execute(id, tenantId, body);
      if (!user) return reply.status(404).send({ error: "Usuário não encontrado" });
      return user;
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...USER_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.delete("/users/:id", { onRequest: [requireAdminHook] }, async (request, reply) => {
    try {
      const tenantId = tenantIdFromRequest(request);
      const currentUserId = userIdFromRequest(request);
      const { id } = userIdParam.parse(request.params);
      const wasDeleted = await org.deleteUser.execute(id, tenantId, currentUserId);
      if (!wasDeleted) return reply.status(404).send({ error: "Usuário não encontrado" });
      return reply.status(204).send();
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...USER_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });
};
