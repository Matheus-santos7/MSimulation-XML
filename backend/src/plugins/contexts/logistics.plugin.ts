import type { FastifyPluginAsync } from "fastify";
import { logisticsUnitController } from "../../modules/logistics/presentation/controllers/logistics-unit.controller.js";
import { movementController } from "../../modules/logistics/presentation/controllers/movement.controller.js";

/** Logística ML: unidades logísticas e movimentações de estoque. Multipart registrado na raiz. */
export const logisticsContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(logisticsUnitController);
  await app.register(movementController);
};
