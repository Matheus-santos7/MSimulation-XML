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
  /** OrderId ML por produto (`xPed` no XML). Gerado se omitido. */
  xPed?: string;
};

/**
 * Checkout / draft creation or edition input.
 *
 * Validated in the presentation layer via `orderCheckoutBody` (Zod).
 */
export type OrderCheckoutInput = {
  items: OrderItemCheckoutInput[];
  comprador: Buyer;
  /** PackId ML (`Pedido.pedidoMl`). Gerado se omitido. */
  pedidoMl?: string;
  /** Order consumer freight in BRL — goes to NF-e `<vFrete>`. */
  freteConsumidor?: number;
  /** Order seller freight in BRL — complements CT-e value (not on NF-e). */
  freteSeller?: number;
};
