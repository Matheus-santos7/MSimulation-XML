import type { OrderCheckoutInput } from "./domain/entities/order-checkout-input.entity.js";
import type { OrderForEmit } from "./domain/entities/order-for-emit.entity.js";
import { emitSalesChain } from "./infrastructure/fiscal/sales-chain.orchestrator.js";
import { createSalesModule } from "./infrastructure/factory/sales-module.factory.js";
import { getDbClient } from "../../lib/db/tenant-rls.js";

export { CheckoutError } from "./domain/errors/checkout.error.js";
export { OrderLockedError } from "./domain/errors/order-locked.error.js";
export { SalesChainError } from "./domain/errors/sales-chain.error.js";
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
  digitsOnly,
} from "./presentation/schemas/order.schemas.js";
export { SaldoRemessaInsuficienteError } from "../remessas/infrastructure/fifo/remessa-fifo.js";
export { emitSaleCte, emitSaleCte as emitirCteVenda } from "./infrastructure/fiscal/cte-sale.adapter.js";

export type PedidoForEmit = OrderForEmit;
export type PedidoCheckoutInput = OrderCheckoutInput;

export async function emitirCadeiaVenda(order: OrderForEmit) {
  return emitSalesChain(getDbClient(), order);
}

export class CheckoutService {
  checkout(tenantId: string, input: OrderCheckoutInput) {
    return createSalesModule().processCheckout.execute(tenantId, input);
  }
}

export class PedidoService {
  private get sales() {
    return createSalesModule();
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
