/** Marketplaces atendidos. O valor é o mesmo do enum `Marketplace` do banco. */
export const Marketplace = {
  MERCADO_LIVRE: "MERCADO_LIVRE",
  SHOPEE: "SHOPEE",
  AMAZON: "AMAZON",
  MAGALU: "MAGALU",
} as const;

export type MarketplaceCode = (typeof Marketplace)[keyof typeof Marketplace];

export const MARKETPLACE_CODES: readonly MarketplaceCode[] = Object.values(Marketplace);

/** Pedidos e notas anteriores ao suporte a vários marketplaces são do Mercado Livre. */
export const LEGACY_DEFAULT_MARKETPLACE: MarketplaceCode = Marketplace.MERCADO_LIVRE;

export function isMarketplaceCode(value: unknown): value is MarketplaceCode {
  return typeof value === "string" && (MARKETPLACE_CODES as readonly string[]).includes(value);
}
