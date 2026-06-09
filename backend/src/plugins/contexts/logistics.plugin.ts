import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { logisticsRoutes } from "../../routes/logistics/index.js";

/** Logística ML: unidades logísticas e movimentações de estoque. */
export const logisticsContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  });
  await app.register(logisticsRoutes);
};
