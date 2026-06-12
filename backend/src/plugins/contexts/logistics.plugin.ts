import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { logisticsUnitController } from "../../modules/logistics/presentation/controllers/logistics-unit.controller.js";
import { movementController } from "../../modules/logistics/presentation/controllers/movement.controller.js";

/** Logística ML: unidades logísticas e movimentações de estoque. */
export const logisticsContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  });
  await app.register(logisticsUnitController);
  await app.register(movementController);
};
