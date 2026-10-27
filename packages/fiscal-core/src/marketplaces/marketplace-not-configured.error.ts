import type { MarketplaceCode } from "./marketplace.js";

export const MARKETPLACE_NOT_CONFIGURED_MESSAGE =
  "Marketplace ainda não configurado para faturamento";

/** Faturamento pedido para um marketplace com perfil `PENDENTE_CONFIGURACAO`. */
export class MarketplaceNotConfiguredError extends Error {
  constructor(readonly marketplace: MarketplaceCode) {
    super(MARKETPLACE_NOT_CONFIGURED_MESSAGE);
    this.name = "MarketplaceNotConfiguredError";
  }
}
