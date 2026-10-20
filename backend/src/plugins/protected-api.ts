import type { FastifyPluginAsync, RouteOptions } from "fastify";
import { wrapProtectedRouteWithDbContext } from "../lib/db/wrap-protected-route.js";
import type { RateLimitHandler } from "../lib/http/rate-limit.js";
import { catalogContextPlugin } from "./contexts/catalog.plugin.js";
import { fiscalContextPlugin } from "./contexts/fiscal.plugin.js";
import { requireEmailVerifiedHook, requireTenantHook } from "./contexts/guards.js";
import { logisticsContextPlugin } from "./contexts/logistics.plugin.js";
import { orgContextPlugin } from "./contexts/org.plugin.js";

export type ProtectedApiPluginOptions = {
  /** Limitador compartilhado com as rotas Nest protegidas (mesmo store). */
  rateLimit: RateLimitHandler;
};

/** Anexa o limitador no fim dos hooks `onRequest` da rota (depois de auth, tenant, e-mail e admin). */
function appendRouteOnRequest(routeOptions: RouteOptions, handler: RateLimitHandler): void {
  const current = routeOptions.onRequest;
  const hooks = Array.isArray(current) ? current : current ? [current] : [];

  routeOptions.onRequest = [...hooks, handler];
}

/**
 * API protegida: JWT obrigatório; tenant obrigatório nas rotas de negócio.
 * Rotas agrupadas por contexto em `plugins/contexts/*` (fase 4).
 *
 * Lookup (CNPJ/CEP) em `authenticated-lookup.ts` (irmão deste plugin).
 *
 * Sem `fastify-plugin` aqui: hooks ficam encapsulados e não bloqueiam `/api/auth/*`.
 */
export const protectedApiPlugin: FastifyPluginAsync<ProtectedApiPluginOptions> = async (app, options) => {
  app.addHook("onRequest", app.authenticate);

  app.addHook("onRoute", (routeOptions) => {
    appendRouteOnRequest(routeOptions, options.rateLimit);
    wrapProtectedRouteWithDbContext(app, routeOptions);
  });

  app.addHook("onRequest", requireTenantHook);
  app.addHook("onRequest", requireEmailVerifiedHook);

  await app.register(orgContextPlugin);
  await app.register(catalogContextPlugin);
  await app.register(fiscalContextPlugin);
  await app.register(logisticsContextPlugin);
};
