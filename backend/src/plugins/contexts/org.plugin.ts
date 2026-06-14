import type { FastifyPluginAsync } from "fastify";
import { tenantController } from "../../modules/org/presentation/controllers/tenant.controller.js";
import { tenantFilialController } from "../../modules/org/presentation/controllers/tenant-filial.controller.js";
import { userController } from "../../modules/org/presentation/controllers/user.controller.js";

/** Organização: tenant (emitente) e usuários do tenant. */
export const orgContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(tenantController);
  await app.register(tenantFilialController);
  await app.register(userController);
};
