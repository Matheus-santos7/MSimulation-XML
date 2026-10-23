import type { OrderCheckoutInput } from "./order-checkout-input.types.js";

/** Rascunho pronto para gravar: ids do pedido e dos itens já resolvidos pelo perfil. */
export type OrderDraftData = Omit<OrderCheckoutInput, "items" | "pedidoMl"> & {
  marketplaceOrderId: string;
  items: Array<OrderCheckoutInput["items"][number] & { xPed: string }>;
};
