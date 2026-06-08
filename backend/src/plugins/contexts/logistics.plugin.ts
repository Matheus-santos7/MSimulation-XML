import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { unidadesLogisticasRoutes } from "../../routes/unidades-logisticas.js";

/** Logística ML: unidades, avanço CD (rotas em unidades-logisticas + fiscal). */
export const logisticsContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  });
  await app.register(unidadesLogisticasRoutes);
};
