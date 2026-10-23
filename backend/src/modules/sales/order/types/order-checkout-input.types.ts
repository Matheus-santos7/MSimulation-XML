import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";
import type { Buyer } from "./buyer.types.js";

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
  /** Id do pedido no marketplace por produto (`xPed` no XML). Gerado se omitido. */
  xPed?: string;
};

/**
 * Checkout / draft creation or edition input.
 *
 * Validated in the presentation layer via `orderCheckoutBody` (Zod).
 */
export type OrderCheckoutInput = {
  /** Marketplace que vai faturar o pedido. */
  marketplace: MarketplaceCode;
  items: OrderItemCheckoutInput[];
  comprador: Buyer;
  /** Id do pedido no marketplace (pack id no ML). Gerado pelo perfil se omitido. */
  pedidoMl?: string;
  /** Order consumer freight in BRL — goes to NF-e `<vFrete>`. */
  freteConsumidor?: number;
  /** Order seller freight in BRL — complements CT-e value (not on NF-e). */
  freteSeller?: number;
};
