import type { FastifyPluginAsync } from "fastify";
import { registerMovimentacoesRoutes } from "./movimentacoes.routes.js";
import { registerUnidadesRoutes } from "./unidades.routes.js";

export const logisticsRoutes: FastifyPluginAsync = async (app) => {
  registerUnidadesRoutes(app);
  registerMovimentacoesRoutes(app);
};
