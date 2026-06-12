import type { FastifyPluginAsync } from "fastify";
import { tenantController, userController } from "../../modules/org/index.js";

/** Organização: tenant (emitente) e usuários do tenant. */
export const orgContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(tenantController);
  await app.register(userController);
};
