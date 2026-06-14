import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { CreateOrderDraftUseCase } from "../../application/use-cases/create-order-draft.use-case.js";
import { EmitSalesChainUseCase } from "../../application/use-cases/emit-sales-chain.use-case.js";
import { GetOrderByIdUseCase } from "../../application/use-cases/get-order-by-id.use-case.js";
import { InvoiceOrderUseCase } from "../../application/use-cases/invoice-order.use-case.js";
import { ListOrdersUseCase } from "../../application/use-cases/list-orders.use-case.js";
import { ProcessCheckoutUseCase } from "../../application/use-cases/process-checkout.use-case.js";
import { RemoveOrderUseCase } from "../../application/use-cases/remove-order.use-case.js";
import { UpdateOrderDraftUseCase } from "../../application/use-cases/update-order-draft.use-case.js";
import { SalesChainOrchestrator } from "../fiscal/sales-chain.orchestrator.js";
import { PrismaOrderRepository } from "../prisma/prisma-order.repository.js";

/** Composition root for the Sales bounded context. */
export function createSalesModule(db: DbClient) {
  const orderRepository = new PrismaOrderRepository(db);
  const salesChain = new SalesChainOrchestrator();

  return {
    listOrders: new ListOrdersUseCase(orderRepository),
    getOrderById: new GetOrderByIdUseCase(orderRepository),
    createOrderDraft: new CreateOrderDraftUseCase(orderRepository),
    updateOrderDraft: new UpdateOrderDraftUseCase(orderRepository),
    invoiceOrder: new InvoiceOrderUseCase(db, orderRepository, salesChain),
    removeOrder: new RemoveOrderUseCase(orderRepository),
    processCheckout: new ProcessCheckoutUseCase(db, orderRepository, salesChain),
    emitSalesChain: new EmitSalesChainUseCase(db, salesChain),
    orderRepository,
    salesChain,
  };
}
