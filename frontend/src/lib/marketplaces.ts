/** Marketplaces aceitos pela API (`GET /api/marketplaces`). */
export type MarketplaceCode = "MERCADO_LIVRE" | "SHOPEE" | "AMAZON" | "MAGALU";

export type MarketplaceDto = {
  code: MarketplaceCode;
  nome: string;
  status: "ATIVO" | "PENDENTE_CONFIGURACAO";
  /** `false`: dá para criar rascunho, mas faturar responde 422. */
  faturamentoDisponivel: boolean;
};

export const DEFAULT_MARKETPLACE: MarketplaceCode = "MERCADO_LIVRE";

/** Rótulo para listas e badges quando a lista da API não está à mão. */
export const MARKETPLACE_LABELS: Record<MarketplaceCode, string> = {
  MERCADO_LIVRE: "Mercado Livre",
  SHOPEE: "Shopee",
  AMAZON: "Amazon",
  MAGALU: "Magalu",
};

export function marketplaceLabel(code: string | undefined | null): string {
  if (!code) return MARKETPLACE_LABELS[DEFAULT_MARKETPLACE];

  return MARKETPLACE_LABELS[code as MarketplaceCode] ?? code;
}

export function isMarketplaceCode(value: unknown): value is MarketplaceCode {
  return typeof value === "string" && value in MARKETPLACE_LABELS;
}
