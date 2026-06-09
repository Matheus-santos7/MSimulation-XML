import type { FastifyPluginAsync } from "fastify";
import { fiscalRoutes } from "../../routes/fiscal/index.js";
import { fiscalSettingsRoutes } from "../../routes/fiscal-settings.js";
import { pedidoRoutes } from "../../routes/pedidos.js";

/**
 * Núcleo fiscal: documentos, emissões via pedido, configurações do emissor ML.
 * Leitura/cancelamento/devolução em `fiscal.ts`; checkout/faturar em `pedidos.ts`.
 */
export const fiscalContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(fiscalRoutes);
  await app.register(fiscalSettingsRoutes);
  await app.register(pedidoRoutes);
};
