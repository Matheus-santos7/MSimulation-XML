import type { FastifyPluginAsync } from "fastify";
import { tenantRoutes, userRoutes } from "../../routes/org/index.js";

/** Organização: tenant (emitente) e usuários do tenant. */
export const orgContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(tenantRoutes);
  await app.register(userRoutes);
};
