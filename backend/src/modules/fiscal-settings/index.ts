/**
 * API pública da configuração do faturador. A emissão lê a configuração efetiva só por
 * `loadEmitterSettings(db, tenantId, marketplace)`. Não reexporta o `FiscalSettingsModule`.
 */
export {
  calcTributoBase,
  composicaoChannel,
  enrichTaxSnapshot,
  loadEmitterSettings,
  mapCstDevolucao,
  resolveDifalMode,
  resolveModFrete,
  type EmitterSnapshot,
  type EnrichTaxContext,
  type FiscalEmitterSettingsData,
  type TaxSnapshot,
} from "./billing-settings/effective-billing-settings.js";
export {
  DEFAULT_FISCAL_EMITTER_SETTINGS,
  DEFAULT_ICMS_FALLBACK_RATES,
  DEFAULT_PIS_COFINS_RATES,
  mergeFiscalEmitterSettings,
} from "./emitter-settings/rules/fiscal-emitter-settings-defaults.js";
export { mergeEmitterSettingsPatch } from "./emitter-settings/rules/merge-emitter-settings-patch.js";
export type {
  EmitterSettingsView,
  UpdateEmitterSettingsInput,
} from "./emitter-settings/emitter-settings.types.js";
export { MarketplaceBillingSettingsService } from "./marketplace-billing-settings/marketplace-billing-settings.service.js";
export type {
  MarketplaceBillingOverrides,
  MarketplaceBillingSettingsView,
} from "./marketplace-billing-settings/marketplace-billing-settings.types.js";
