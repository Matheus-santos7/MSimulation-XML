import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { productController } from "../../modules/catalog/presentation/controllers/product.controller.js";

/** Catálogo: produtos e preços (regra fiscal via taxRuleBaseId). */
export const catalogContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  });
  await app.register(productController);
};
