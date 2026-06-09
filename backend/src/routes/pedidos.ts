import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { tenantIdFromRequest } from "../lib/auth/request-context.js";
import { handleRouteError } from "../lib/http/domain-errors.js";
import { pedidoCheckoutBody } from "../schemas/pedido-checkout.js";
import { CheckoutError } from "../services/checkout-service.js";
import {
  PedidoLockedError,
  PedidoService,
  SaldoRemessaInsuficienteError,
} from "../services/pedido-service.js";

const pedidoIdParam = z.object({ id: z.string().uuid() });

const PEDIDO_ERROR_MAPPINGS = [
  { type: PedidoLockedError, status: 409 },
  { type: CheckoutError, status: 400 },
  {
    type: SaldoRemessaInsuficienteError,
    status: 422,
    toBody: (error: Error) => {
      const e = error as SaldoRemessaInsuficienteError;
      return {
        error: e.message,
        disponivel: e.disponivel,
        solicitado: e.solicitado,
      };
    },
  },
] as const;

export const pedidoRoutes: FastifyPluginAsync = async (app) => {
  const service = new PedidoService(app.prisma);

  app.get("/pedidos", async (req) => {
    const tid = tenantIdFromRequest(req);
    return service.list(tid);
  });

  app.get("/pedidos/:id", async (req, reply) => {
    const { id } = pedidoIdParam.parse(req.params);
    const tid = tenantIdFromRequest(req);
    const pedido = await service.getById(id, tid);
    if (!pedido) return reply.status(404).send({ error: "Pedido não encontrado" });
    return pedido;
  });

  app.post("/pedidos", async (req, reply) => {
    try {
      const tid = tenantIdFromRequest(req);
      const body = pedidoCheckoutBody.parse(req.body);
      const pedido = await service.createDraft(tid, body);
      return reply.status(201).send(pedido);
    } catch (e) {
      if (handleRouteError(reply, e, { mappings: [...PEDIDO_ERROR_MAPPINGS] })) return;
      throw e;
    }
  });

  app.patch("/pedidos/:id", async (req, reply) => {
    try {
      const { id } = pedidoIdParam.parse(req.params);
      const tid = tenantIdFromRequest(req);
      const body = pedidoCheckoutBody.parse(req.body);
      const pedido = await service.updateDraft(id, tid, body);
      if (!pedido) return reply.status(404).send({ error: "Pedido não encontrado" });
      return pedido;
    } catch (e) {
      if (handleRouteError(reply, e, { mappings: [...PEDIDO_ERROR_MAPPINGS] })) return;
      throw e;
    }
  });

  app.post("/pedidos/:id/faturar", async (req, reply) => {
    try {
      const { id } = pedidoIdParam.parse(req.params);
      const tid = tenantIdFromRequest(req);
      const result = await service.faturar(id, tid);
      if (!result) return reply.status(404).send({ error: "Pedido não encontrado" });
      return reply.status(201).send(result);
    } catch (e) {
      if (handleRouteError(reply, e, { mappings: [...PEDIDO_ERROR_MAPPINGS] })) return;
      throw e;
    }
  });

  app.delete("/pedidos/:id", async (req, reply) => {
    try {
      const { id } = pedidoIdParam.parse(req.params);
      const tid = tenantIdFromRequest(req);
      const removed = await service.remove(id, tid);
      if (!removed) return reply.status(404).send({ error: "Pedido não encontrado" });
      return reply.status(204).send();
    } catch (e) {
      if (handleRouteError(reply, e, { mappings: [...PEDIDO_ERROR_MAPPINGS] })) return;
      throw e;
    }
  });

  app.post("/pedidos/checkout", async (req, reply) => {
    try {
      const tid = tenantIdFromRequest(req);
      const body = pedidoCheckoutBody.parse(req.body);
      const { CheckoutService } = await import("../services/checkout-service.js");
      const checkout = new CheckoutService(app.prisma);
      const nfe = await checkout.checkout(tid, body);
      return reply.status(201).send(nfe);
    } catch (e) {
      if (handleRouteError(reply, e, { mappings: [...PEDIDO_ERROR_MAPPINGS] })) return;
      throw e;
    }
  });
};
