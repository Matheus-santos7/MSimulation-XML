import { gerarIdPedidoNumerico, type MarketplaceOrderIdRules } from "../order-id.js";

const ML_ORDER_ID_PATTERN = /^\d{1,20}$/;

/** Pack id do Mercado Livre: só dígitos (os reais têm 16). */
export const ML_ORDER_ID_RULES: MarketplaceOrderIdRules = {
  validar: (id) =>
    ML_ORDER_ID_PATTERN.test(id)
      ? null
      : "Id do pedido no Mercado Livre deve ter só números (até 20 dígitos)",
  gerar: () => gerarIdPedidoNumerico(),
};
