import type { Buyer } from "./buyer.entity.js";

/**
 * Single line item inside an order checkout payload.
 *
 * Today the persistence layer still stores a single product per `pedido`,
 * but the domain input is already prepared to support multiple items.
 */
export type OrderItemCheckoutInput = {
  productId: string;
  quantidade: number;
  /** Line discount in BRL (default 0). */
  desconto?: number;
  /** Line freight in BRL (default 0, typically rateado). */
  frete?: number;
};

/**
 * Checkout / draft creation or edition input.
 *
 * Validated in the presentation layer via `orderCheckoutBody` (Zod).
 * The API accepts an array of items to support multi-product orders,
 * even if the current Prisma model persists only the first item.
 */
export type OrderCheckoutInput = {
  items: OrderItemCheckoutInput[];
  comprador: Buyer;
};
