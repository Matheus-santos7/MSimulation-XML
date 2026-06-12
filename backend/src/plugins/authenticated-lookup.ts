import type { FastifyPluginAsync } from "fastify";
import { lookupController } from "../modules/lookup/presentation/controllers/lookup.controller.js";

/**
 * Lookup CNPJ/CEP: só JWT, sem tenant (onboarding).
 * Plugin irmão de `protected-api` — evita herdar `requireTenantHook` do escopo pai.
 */
export const authenticatedLookupPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);
  await app.register(lookupController);
};
