import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { handleRouteError } from "../../../../lib/http/domain-errors.js";
import { requireAdminHook } from "../../../../plugins/contexts/guards.js";
import { SaldoRemessaInsuficienteError } from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import { CheckoutError } from "../../domain/errors/checkout.error.js";
import { OrderLockedError } from "../../domain/errors/order-locked.error.js";
import { SalesChainError } from "../../domain/errors/sales-chain.error.js";
import { createSalesModule } from "../../infrastructure/factory/sales-module.factory.js";
import { orderCheckoutBody, orderIdParam } from "../schemas/order.schemas.js";

/** Mapeamento de erros de domínio da venda para códigos HTTP na API. */
const ORDER_ERROR_MAPPINGS = [
  { type: OrderLockedError, status: 409 },
  { type: CheckoutError, status: 400 },
  { type: SalesChainError, status: 400 },
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

/**
 * Controller HTTP de pedidos de venda (Sales).
 *
 * Regista rotas sob o prefixo fiscal (`/pedidos`). Delega toda a lógica aos use cases
 * do módulo; valida entrada com Zod e traduz erros de domínio via `handleRouteError`.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/pedidos` | ListOrdersUseCase |
 * | GET | `/pedidos/:id` | GetOrderByIdUseCase |
 * | POST | `/pedidos` | CreateOrderDraftUseCase |
 * | PATCH | `/pedidos/:id` | UpdateOrderDraftUseCase |
 * | DELETE | `/pedidos/:id` | RemoveOrderUseCase |
 * | POST | `/pedidos/:id/faturar` | InvoiceOrderUseCase (ADMIN) |
 * | POST | `/pedidos/checkout` | ProcessCheckoutUseCase (ADMIN) |
 */
export const orderController: FastifyPluginAsync = async (app) => {
  const sales = createSalesModule();

  app.get("/pedidos", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    return sales.listOrders.execute(tenantId);
  });

  app.get("/pedidos/:id", async (req, reply) => {
    const { id } = orderIdParam.parse(req.params);
    const tenantId = tenantIdFromRequest(req);
    const order = await sales.getOrderById.execute(tenantId, id);
    if (!order) return reply.status(404).send({ error: "Pedido não encontrado" });
    return order;
  });

  app.post("/pedidos", async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const body = orderCheckoutBody.parse(req.body);
      const order = await sales.createOrderDraft.execute(tenantId, body);
      return reply.status(201).send(order);
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...ORDER_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.patch("/pedidos/:id", async (req, reply) => {
    try {
      const { id } = orderIdParam.parse(req.params);
      const tenantId = tenantIdFromRequest(req);
      const body = orderCheckoutBody.parse(req.body);
      const order = await sales.updateOrderDraft.execute(id, tenantId, body);
      if (!order) return reply.status(404).send({ error: "Pedido não encontrado" });
      return order;
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...ORDER_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.post("/pedidos/:id/faturar", { onRequest: [requireAdminHook] }, async (req, reply) => {
    try {
      const { id } = orderIdParam.parse(req.params);
      const tenantId = tenantIdFromRequest(req);
      const result = await sales.invoiceOrder.execute(tenantId, id);
      if (!result) return reply.status(404).send({ error: "Pedido não encontrado" });
      return reply.status(201).send(result);
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...ORDER_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.delete("/pedidos/:id", async (req, reply) => {
    try {
      const { id } = orderIdParam.parse(req.params);
      const tenantId = tenantIdFromRequest(req);
      const removed = await sales.removeOrder.execute(tenantId, id);
      if (!removed) return reply.status(404).send({ error: "Pedido não encontrado" });
      return reply.status(204).send();
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...ORDER_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });

  app.post("/pedidos/checkout", { onRequest: [requireAdminHook] }, async (req, reply) => {
    try {
      const tenantId = tenantIdFromRequest(req);
      const body = orderCheckoutBody.parse(req.body);
      const nfe = await sales.processCheckout.execute(tenantId, body);
      return reply.status(201).send(nfe);
    } catch (error) {
      if (handleRouteError(reply, error, { mappings: [...ORDER_ERROR_MAPPINGS] })) return;
      throw error;
    }
  });
};
