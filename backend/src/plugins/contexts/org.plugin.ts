import type { FastifyPluginAsync } from "fastify";
import { tenantRoutes } from "../../routes/tenants.js";
import { userRoutes } from "../../routes/users.js";

/** Organização: tenant (emitente) e usuários do tenant. */
export const orgContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(tenantRoutes);
  await app.register(userRoutes);
};
