import type { OrderCheckoutInput } from "../entities/order-checkout-input.entity.js";
import type { OrderForEmit } from "../entities/order-for-emit.entity.js";
import type { Order } from "../entities/order.entity.js";

export interface OrderRepository {
  listByTenant(tenantId: string): Promise<Order[]>;
  findById(tenantId: string, id: string): Promise<Order | null>;
  findForEmit(tenantId: string, id: string): Promise<OrderForEmit | null>;
  createDraft(tenantId: string, input: OrderCheckoutInput): Promise<Order>;
  updateDraft(id: string, tenantId: string, input: OrderCheckoutInput): Promise<Order | null>;
  markInvoiced(id: string, pedidoMl: string, nfeId: string): Promise<Order>;
  delete(id: string, tenantId: string): Promise<boolean>;
  assertProductsBelongToTenant(tenantId: string, productIds: string[]): Promise<{ id: string }[]>;
  loadCheckoutContext(
    tenantId: string,
    productIds: string[],
  ): Promise<{
    products: OrderForEmit["items"][number]["product"][];
    tenant: OrderForEmit["tenant"];
  }>;
}
