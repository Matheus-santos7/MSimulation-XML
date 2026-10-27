import type { FiscalEmitterSettingsData } from "../fiscal-emitter-settings-types";
import type { MarketplaceCode, MarketplaceDto } from "../marketplaces";
import { buildApiUrl, getJson, mutateJson } from "./client";

/** O que o marketplace muda em relação ao padrão da empresa (vazio = herda tudo). */
export type MarketplaceBillingOverrides = {
  basic?: Partial<FiscalEmitterSettingsData["basic"]>;
  taxes?: Partial<FiscalEmitterSettingsData["taxes"]>;
  nfe?: Partial<FiscalEmitterSettingsData["nfe"]>;
};

/** `GET /api/fiscal-settings/marketplaces/:marketplace`: sobrescrita e configuração efetiva. */
export type MarketplaceBillingSettingsView = {
  marketplace: MarketplaceCode;
  overrides: MarketplaceBillingOverrides;
  effective: FiscalEmitterSettingsData;
};

export async function listMarketplaces(): Promise<MarketplaceDto[]> {
  return getJson<MarketplaceDto[]>(buildApiUrl("/api/marketplaces"));
}

export async function getMarketplaceBillingSettings(
  marketplace: MarketplaceCode,
): Promise<MarketplaceBillingSettingsView> {
  return getJson<MarketplaceBillingSettingsView>(
    buildApiUrl(`/api/fiscal-settings/marketplaces/${marketplace}`),
  );
}

/** Substitui a sobrescrita do marketplace; `{}` volta a herdar tudo do padrão. */
export async function replaceMarketplaceBillingSettings(
  marketplace: MarketplaceCode,
  overrides: MarketplaceBillingOverrides,
): Promise<MarketplaceBillingSettingsView> {
  return mutateJson<MarketplaceBillingSettingsView>(
    buildApiUrl(`/api/fiscal-settings/marketplaces/${marketplace}`),
    "PUT",
    overrides,
  ) as Promise<MarketplaceBillingSettingsView>;
}
