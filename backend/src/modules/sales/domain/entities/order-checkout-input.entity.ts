import type { Buyer } from "./buyer.entity.js";

/**
 * Entrada de checkout ou de criação/edição de rascunho de pedido.
 *
 * Validada na camada presentation via `orderCheckoutBody` (Zod).
 */
export type OrderCheckoutInput = {
  productId: string;
  quantidade: number;
  /** Desconto da linha em R$ (default 0). */
  desconto?: number;
  /** Frete da linha em R$ (default 0). */
  frete?: number;
  comprador: Buyer;
};
