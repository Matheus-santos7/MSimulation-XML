import type { Buyer } from "./buyer.entity.js";

/**
 * Entrada de checkout ou de criação/edição de rascunho de pedido.
 *
 * Validada na camada presentation via `orderCheckoutBody` (Zod).
 */
export type OrderCheckoutInput = {
  productId: string;
  quantidade: number;
  comprador: Buyer;
};
