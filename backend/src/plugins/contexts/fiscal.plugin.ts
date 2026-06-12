import type { FastifyPluginAsync } from "fastify";
import {
  cteController,
  fiscalObservabilityController,
  nfeController,
  nfeLifecycleController,
} from "../../modules/fiscal-documents/index.js";
import { orderController } from "../../modules/sales/index.js";
import { taxRuleController } from "../../modules/tax/index.js";
import { fiscalSettingsRoutes } from "../../routes/fiscal/index.js";

/**
 * Núcleo fiscal: documentos, pedidos, configurações do emissor ML.
 */
export const fiscalContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(nfeLifecycleController);
  await app.register(nfeController);
  await app.register(cteController);
  await app.register(fiscalObservabilityController);
  await app.register(taxRuleController);
  await app.register(fiscalSettingsRoutes);
  await app.register(orderController);
};
