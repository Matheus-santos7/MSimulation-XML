import type { FastifyPluginAsync } from "fastify";
import { productController } from "../../modules/catalog/presentation/controllers/product.controller.js";

/** Catálogo: produtos e preços (regra fiscal via taxRuleBaseId). Multipart registrado na raiz. */
export const catalogContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(productController);
};
