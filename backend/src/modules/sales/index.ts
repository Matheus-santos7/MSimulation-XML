import type { PrismaClient } from "../../generated/prisma/client.js";
import type { OrderCheckoutInput } from "./domain/entities/order-checkout-input.entity.js";
import type { OrderForEmit } from "./domain/entities/order-for-emit.entity.js";
import { emitSalesChain } from "./infrastructure/fiscal/sales-chain.orchestrator.js";
import { createSalesModule } from "./infrastructure/factory/sales-module.factory.js";

export { CheckoutError } from "./domain/errors/checkout.error.js";
export { OrderLockedError, PedidoLockedError } from "./domain/errors/order-locked.error.js";
export { SalesChainError, VendaChainError } from "./domain/errors/sales-chain.error.js";
export type { Buyer } from "./domain/entities/buyer.entity.js";
export type { OrderCheckoutInput } from "./domain/entities/order-checkout-input.entity.js";
export type { Order, OrderProductSummary } from "./domain/entities/order.entity.js";
export type {
  OrderForEmit,
  OrderProductForEmit,
  TenantForSalesEmit,
} from "./domain/entities/order-for-emit.entity.js";
export type { EmissionContext } from "./domain/entities/emission-context.entity.js";
export { createSalesModule, emitSalesChain };
export { mapOrderFromPrisma } from "./infrastructure/prisma/order-prisma.mapper.js";
export { orderController } from "./presentation/controllers/order.controller.js";
export {
  buyerCheckoutBody,
  orderCheckoutBody,
  orderIdParam,
  pedidoCheckoutBody,
  pedidoIdParam,
  compradorCheckoutBody,
  digitsOnly,
} from "./presentation/schemas/order.schemas.js";
export { SaldoRemessaInsuficienteError } from "../remessas/infrastructure/fifo/remessa-fifo.js";
export { emitSaleCte, emitSaleCte as emitirCteVenda } from "./infrastructure/fiscal/cte-sale.adapter.js";

export type PedidoForEmit = OrderForEmit;
export type PedidoCheckoutInput = OrderCheckoutInput;

export async function emitirCadeiaVenda(prisma: PrismaClient, order: OrderForEmit) {
  return emitSalesChain(prisma, order);
}

export class CheckoutService {
  constructor(private readonly prisma: PrismaClient) {}

  checkout(tenantId: string, input: OrderCheckoutInput) {
    return createSalesModule(this.prisma).processCheckout.execute(tenantId, input);
  }
}

export class PedidoService {
  constructor(private readonly prisma: PrismaClient) {}

  private get sales() {
    return createSalesModule(this.prisma);
  }

  list(tenantId: string) {
    return this.sales.listOrders.execute(tenantId);
  }

  getById(id: string, tenantId: string) {
    return this.sales.getOrderById.execute(tenantId, id);
  }

  createDraft(tenantId: string, input: OrderCheckoutInput) {
    return this.sales.createOrderDraft.execute(tenantId, input);
  }

  updateDraft(id: string, tenantId: string, input: OrderCheckoutInput) {
    return this.sales.updateOrderDraft.execute(id, tenantId, input);
  }

  faturar(id: string, tenantId: string) {
    return this.sales.invoiceOrder.execute(tenantId, id);
  }

  remove(id: string, tenantId: string) {
    return this.sales.removeOrder.execute(tenantId, id);
  }
}
