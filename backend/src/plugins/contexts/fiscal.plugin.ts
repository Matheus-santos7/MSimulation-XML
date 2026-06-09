import type { FastifyPluginAsync } from "fastify";
import { fiscalRoutes, fiscalSettingsRoutes, pedidoRoutes } from "../../routes/fiscal/index.js";

/**
 * Núcleo fiscal: documentos, pedidos, configurações do emissor ML.
 */
export const fiscalContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(fiscalRoutes);
  await app.register(fiscalSettingsRoutes);
  await app.register(pedidoRoutes);
};
