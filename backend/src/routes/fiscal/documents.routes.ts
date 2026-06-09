/**
 * Rotas HTTP de documentos fiscais, timeline e regras tributárias (prefixo `/api`).
 */
import type { FastifyPluginAsync } from "fastify";
import { FiscalService } from "../../services/fiscal/index.js";
import { registerCteAndEmitenteRoutes } from "./ctes.routes.js";
import { registerNfeRoutes } from "./nfes.routes.js";
import { registerObservabilityRoutes } from "./observability.routes.js";
import { registerTaxRuleRoutes } from "./tax-rules.routes.js";

export const fiscalRoutes: FastifyPluginAsync = async (app) => {
  const fiscal = new FiscalService(app.prisma);

  registerNfeRoutes(app, fiscal);
  registerCteAndEmitenteRoutes(app, fiscal);
  registerObservabilityRoutes(app);
  registerTaxRuleRoutes(app);
};
