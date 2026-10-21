import type { FastifyPluginAsync } from "fastify";
import { orderController } from "../../modules/sales/presentation/controllers/order.controller.js";

/** Pedidos de venda (último controller do núcleo fiscal ainda em Fastify). */
export const fiscalContextPlugin: FastifyPluginAsync = async (app) => {
  await app.register(orderController);
};
