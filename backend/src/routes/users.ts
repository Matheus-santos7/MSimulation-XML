import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { tenantIdFromRequest, userIdFromRequest } from "../lib/auth/request-context.js";
import { userCreateBody, userIdParam, userUpdateBody } from "../schemas/user.js";
import {
  UserConflictError,
  UserForbiddenError,
  UserService,
} from "../services/user-service.js";

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

  app.post("/users", async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const body = userCreateBody.parse(req.body);
      const user = await service.create(tenantId, body);
      return reply.status(201).send(user);
    } catch (e) {
      return handleUserError(e, reply);
    }
  });

  app.patch("/users/:id", async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const { id } = userIdParam.parse(req.params);
      const body = userUpdateBody.parse(req.body);
      const user = await service.update(id, tenantId, body);
      if (!user) return reply.status(404).send({ error: "Usuário não encontrado" });
      return user;
    } catch (e) {
      return handleUserError(e, reply);
    }
  });

  app.delete("/users/:id", async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const currentUserId = userIdFromRequest(req);
      const { id } = userIdParam.parse(req.params);
      const removed = await service.remove(id, tenantId, currentUserId);
      if (!removed) return reply.status(404).send({ error: "Usuário não encontrado" });
      return reply.status(204).send();
    } catch (e) {
      return handleUserError(e, reply);
    }
  });
};

function handleUserError(e: unknown, reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
  if (e instanceof ZodError) {
    const fieldErrors = e.flatten().fieldErrors as Record<string, string[]>;
    const first = Object.values(fieldErrors).flat()[0];
    return reply.status(400).send({
      error: first ?? "Dados inválidos",
      details: fieldErrors,
    });
  }
  if (e instanceof UserConflictError) {
    return reply.status(409).send({ error: e.message });
  }
  if (e instanceof UserForbiddenError) {
    return reply.status(403).send({ error: e.message });
  }
  throw e;
}
