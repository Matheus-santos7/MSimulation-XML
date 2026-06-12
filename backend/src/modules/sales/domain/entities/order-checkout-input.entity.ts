import type { Buyer } from "./buyer.entity.js";

export type OrderCheckoutInput = {
  productId: string;
  quantidade: number;
  comprador: Buyer;
};
