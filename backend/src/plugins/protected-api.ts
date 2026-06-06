import type { FastifyPluginAsync } from "fastify";
import { catalogContextPlugin } from "./contexts/catalog.plugin.js";
import { fiscalContextPlugin } from "./contexts/fiscal.plugin.js";
import { requireTenantHook } from "./contexts/guards.js";
import { logisticsContextPlugin } from "./contexts/logistics.plugin.js";
import { orgContextPlugin } from "./contexts/org.plugin.js";

/**
 * API protegida: JWT obrigatório; tenant obrigatório nas rotas de negócio.
 * Rotas agrupadas por contexto em `plugins/contexts/*` (fase 4).
 *
 * Lookup (CNPJ/CEP) em `authenticated-lookup.ts` (irmão deste plugin).
 *
 * Sem `fastify-plugin` aqui: hooks ficam encapsulados e não bloqueiam `/api/auth/*`.
 */
export const protectedApiPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);
  app.addHook("onRequest", requireTenantHook);

  await app.register(orgContextPlugin);
  await app.register(catalogContextPlugin);
  await app.register(fiscalContextPlugin);
  await app.register(logisticsContextPlugin);
};
