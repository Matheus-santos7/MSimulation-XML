import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";
import type { FiscalEmitterSettingsData } from "../emitter-settings/rules/fiscal-emitter-settings-defaults.js";

/**
 * O que um marketplace muda na configuração padrão da empresa. Mesmas seções do
 * `PATCH /fiscal-settings`; campo ausente herda o padrão.
 */
export type MarketplaceBillingOverrides = {
  basic?: Record<string, unknown>;
  taxes?: Record<string, unknown>;
  nfe?: Record<string, unknown>;
};

/** Resposta de `/fiscal-settings/marketplaces/:marketplace`: sobrescrita e resultado do merge. */
export type MarketplaceBillingSettingsView = {
  marketplace: MarketplaceCode;
  /** Só o que difere do padrão da empresa. */
  overrides: MarketplaceBillingOverrides;
  /** Configuração usada na emissão: padrão da empresa + sobrescrita. */
  effective: FiscalEmitterSettingsData;
};
