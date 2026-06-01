import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { fiscalRoutes } from "../routes/fiscal.js";
import { fiscalSettingsRoutes } from "../routes/fiscal-settings.js";
import { tenantRoutes } from "../routes/tenants.js";
import { productRoutes } from "../routes/products.js";
import { pedidoRoutes } from "../routes/pedidos.js";
import { unidadesLogisticasRoutes } from "../routes/unidades-logisticas.js";
import { userRoutes } from "../routes/users.js";

/**
 * Rotas da API que exigem JWT válido (`Authorization: Bearer`).
 * O `tenantId` vem exclusivamente de `request.user.tenantId`.
 */
async function requireTenantHook(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user.tenantId) {
    return reply.status(403).send({ error: "Cadastre uma empresa para continuar" });
  }
}

/** Sem `fastify-plugin`: hooks ficam encapsulados e não bloqueiam `/api/auth/login` nem `/api/auth/register`. */
export const protectedApiPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);
  app.addHook("onRequest", requireTenantHook);

  await app.register(tenantRoutes);
  await app.register(productRoutes);
  await app.register(pedidoRoutes);
  await app.register(fiscalRoutes);
  await app.register(fiscalSettingsRoutes);
  await app.register(unidadesLogisticasRoutes);
  await app.register(userRoutes);
};
