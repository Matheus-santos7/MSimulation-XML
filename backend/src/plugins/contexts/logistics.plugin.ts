import type { FastifyPluginAsync } from "fastify";
import { unidadesLogisticasRoutes } from "../../routes/unidades-logisticas.js";

/** Logística ML: unidades, avanço CD (rotas em unidades-logisticas + fiscal). */
export const logisticsContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(unidadesLogisticasRoutes);
};
