import type { FastifyPluginAsync } from "fastify";
import { productRoutes } from "../../routes/products.js";

/** Catálogo: produtos e preços (regra fiscal via taxRuleBaseId). */
export const catalogContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(productRoutes);
};
