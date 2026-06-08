import type { FastifyPluginAsync } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { applyRlsContext, clearRlsContext, dbRequestContext } from "../lib/db/tenant-rls.js";
import { catalogContextPlugin } from "./contexts/catalog.plugin.js";
import { fiscalContextPlugin } from "./contexts/fiscal.plugin.js";
import { requireEmailVerifiedHook, requireTenantHook } from "./contexts/guards.js";
import { logisticsContextPlugin } from "./contexts/logistics.plugin.js";
import { orgContextPlugin } from "./contexts/org.plugin.js";

const PROTECTED_API_RATE_LIMIT = {
  max: 300,
  timeWindow: "1 minute",
};

/**
 * API protegida: JWT obrigatório; tenant obrigatório nas rotas de negócio.
 * Rotas agrupadas por contexto em `plugins/contexts/*` (fase 4).
 *
 * Lookup (CNPJ/CEP) em `authenticated-lookup.ts` (irmão deste plugin).
 *
 * Sem `fastify-plugin` aqui: hooks ficam encapsulados e não bloqueiam `/api/auth/*`.
 */
export const protectedApiPlugin: FastifyPluginAsync = async (app) => {
  await app.register(rateLimit, {
    global: true,
    max: PROTECTED_API_RATE_LIMIT.max,
    timeWindow: PROTECTED_API_RATE_LIMIT.timeWindow,
    keyGenerator: (req) => req.ip,
  });

  app.addHook("onRequest", app.authenticate);

  app.addHook("onRequest", async (req) => {
    const ctx = {
      userId: req.user.userId,
      tenantId: req.user.tenantId ?? undefined,
    };
    dbRequestContext.enterWith(ctx);
    await applyRlsContext(app.prisma, ctx);
  });

  app.addHook("onResponse", async () => {
    await clearRlsContext(app.prisma);
  });

  app.addHook("onRequest", requireTenantHook);
  app.addHook("onRequest", requireEmailVerifiedHook);

  await app.register(orgContextPlugin);
  await app.register(catalogContextPlugin);
  await app.register(fiscalContextPlugin);
  await app.register(logisticsContextPlugin);
};

export { PROTECTED_API_RATE_LIMIT };
