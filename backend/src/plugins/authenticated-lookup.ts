import type { FastifyPluginAsync } from "fastify";
import { lookupRoutes } from "../routes/lookup/index.js";

/**
 * Lookup CNPJ/CEP: só JWT, sem tenant (onboarding).
 * Plugin irmão de `protected-api` — evita herdar `requireTenantHook` do escopo pai.
 */
export const authenticatedLookupPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);
  await app.register(lookupRoutes);
};
