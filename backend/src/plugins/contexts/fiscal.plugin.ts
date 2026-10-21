import type { FastifyPluginAsync } from "fastify";
import { cteController } from "../../modules/fiscal-documents/presentation/controllers/cte.controller.js";
import { fiscalObservabilityController } from "../../modules/fiscal-documents/presentation/controllers/fiscal-observability.controller.js";
import { nfeController } from "../../modules/fiscal-documents/presentation/controllers/nfe.controller.js";
import { nfeLifecycleController } from "../../modules/fiscal-documents/presentation/controllers/nfe-lifecycle.controller.js";
import { orderController } from "../../modules/sales/presentation/controllers/order.controller.js";

/**
 * Núcleo fiscal: documentos e pedidos. O hook de pós-commit fiscal (revalidação de NF-e)
 * é registrado pelo `FiscalValidationModule` do Nest.
 */
export const fiscalContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(nfeLifecycleController);
  await app.register(nfeController);
  await app.register(cteController);
  await app.register(fiscalObservabilityController);
  await app.register(orderController);
};
