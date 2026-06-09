import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest, userIdFromRequest } from "../lib/auth/request-context.js";
import { handleRouteError } from "../lib/http/domain-errors.js";
import { requireAdminHook } from "../plugins/contexts/guards.js";
import { userCreateBody, userIdParam, userUpdateBody } from "../schemas/user.js";
import {
  UserConflictError,
  UserForbiddenError,
  UserService,
} from "../services/user-service.js";

const USER_ERROR_MAPPINGS = [
  { type: UserConflictError, status: 409 },
  { type: UserForbiddenError, status: 403 },
] as const;

export const userRoutes: FastifyPluginAsync = async (app) => {
  const service = new UserService(app.prisma);

  app.get("/users", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    return service.list(tenantId);
  });

  app.get("/users/:id", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { id } = userIdParam.parse(req.params);
    const user = await service.getById(id, tenantId);
    if (!user) return reply.status(404).send({ error: "Usuário não encontrado" });
    return user;
  });

  app.post("/users", { onRequest: [requireAdminHook] }, async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const body = userCreateBody.parse(req.body);
      const user = await service.create(tenantId, body);
      return reply.status(201).send(user);
    } catch (e) {
      if (handleRouteError(reply, e, { mappings: [...USER_ERROR_MAPPINGS] })) return;
      throw e;
    }
  });

  app.patch("/users/:id", { onRequest: [requireAdminHook] }, async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const { id } = userIdParam.parse(req.params);
      const body = userUpdateBody.parse(req.body);
      const user = await service.update(id, tenantId, body);
      if (!user) return reply.status(404).send({ error: "Usuário não encontrado" });
      return user;
    } catch (e) {
      if (handleRouteError(reply, e, { mappings: [...USER_ERROR_MAPPINGS] })) return;
      throw e;
    }
  });

  app.delete("/users/:id", { onRequest: [requireAdminHook] }, async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const currentUserId = userIdFromRequest(req);
      const { id } = userIdParam.parse(req.params);
      const removed = await service.remove(id, tenantId, currentUserId);
      if (!removed) return reply.status(404).send({ error: "Usuário não encontrado" });
      return reply.status(204).send();
    } catch (e) {
      if (handleRouteError(reply, e, { mappings: [...USER_ERROR_MAPPINGS] })) return;
      throw e;
    }
  });
};
