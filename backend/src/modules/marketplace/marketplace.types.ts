import type { MarketplaceCode, MarketplaceProfileStatus } from "@msimulation-xml/fiscal-core";

/** Marketplace no seletor do pedido e das configurações. */
export type MarketplaceSummary = {
  code: MarketplaceCode;
  nome: string;
  status: MarketplaceProfileStatus;
  /** `false` enquanto o perfil fiscal estiver pendente: faturar responde 422. */
  faturamentoDisponivel: boolean;
};
