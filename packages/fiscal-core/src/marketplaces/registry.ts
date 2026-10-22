import { amazonProfile } from "./amazon/index.js";
import { magaluProfile } from "./magalu/index.js";
import { Marketplace, type MarketplaceCode } from "./marketplace.js";
import type { MarketplaceFiscalProfile } from "./marketplace-fiscal-profile.js";
import { MarketplaceNotConfiguredError } from "./marketplace-not-configured.error.js";
import { mercadoLivreProfile } from "./mercado-livre/index.js";
import { shopeeProfile } from "./shopee/index.js";

const PROFILES: Readonly<Record<MarketplaceCode, MarketplaceFiscalProfile>> = {
  [Marketplace.MERCADO_LIVRE]: mercadoLivreProfile,
  [Marketplace.SHOPEE]: shopeeProfile,
  [Marketplace.AMAZON]: amazonProfile,
  [Marketplace.MAGALU]: magaluProfile,
};

export function getMarketplaceProfile(code: MarketplaceCode): MarketplaceFiscalProfile {
  return PROFILES[code];
}

export function listMarketplaceProfiles(): readonly MarketplaceFiscalProfile[] {
  return Object.values(PROFILES);
}

/** Perfil pronto para faturar; lança `MarketplaceNotConfiguredError` se estiver pendente. */
export function getBillableMarketplaceProfile(code: MarketplaceCode): MarketplaceFiscalProfile {
  const profile = getMarketplaceProfile(code);
  if (profile.status !== "ATIVO") throw new MarketplaceNotConfiguredError(code);

  return profile;
}
