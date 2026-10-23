/** Regras do id do pedido no marketplace (pack id no Mercado Livre). */
export type MarketplaceOrderIdRules = {
  /** Mensagem de erro quando o id não segue o formato do marketplace; `null` quando vale. */
  validar(id: string): string | null;
  /** Gera um id no formato do marketplace, para pedidos criados sem id. */
  gerar(): string;
};

const NUMERIC_ORDER_ID_LENGTH = 16;
const RANDOM_SUFFIX_DIGITS = 6;

/** Id numérico de 16 dígitos: "2" + epoch em ms + sufixo aleatório, cortado. */
export function gerarIdPedidoNumerico(now: () => number = Date.now): string {
  const randomSuffix = Math.floor(Math.random() * 10 ** RANDOM_SUFFIX_DIGITS)
    .toString()
    .padStart(RANDOM_SUFFIX_DIGITS, "0");

  return `2${now()}${randomSuffix}`.slice(0, NUMERIC_ORDER_ID_LENGTH);
}

/**
 * Marketplace sem regras levantadas: aceita qualquer id e gera o numérico. O faturamento
 * continua bloqueado pelo status do perfil.
 */
export const PENDING_ORDER_ID_RULES: MarketplaceOrderIdRules = {
  validar: () => null,
  gerar: () => gerarIdPedidoNumerico(),
};
