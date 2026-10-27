import type { FiscalEmitterSettingsData } from "../../emitter-settings/rules/fiscal-emitter-settings-defaults.js";
import { mergeEmitterSettingsPatch } from "../../emitter-settings/rules/merge-emitter-settings-patch.js";
import type { MarketplaceBillingOverrides } from "../marketplace-billing-settings.types.js";

/** Lê a sobrescrita gravada (JSON), aceitando só as seções conhecidas. */
export function parseMarketplaceOverrides(raw: unknown): MarketplaceBillingOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const value = raw as Record<string, unknown>;
  const section = (key: "basic" | "taxes" | "nfe") =>
    value[key] && typeof value[key] === "object" && !Array.isArray(value[key])
      ? { [key]: value[key] as Record<string, unknown> }
      : {};

  return { ...section("basic"), ...section("taxes"), ...section("nfe") };
}

/**
 * Configuração efetiva de um marketplace: padrão da empresa + sobrescrita, com o mesmo merge
 * profundo do `PATCH /fiscal-settings` (o padrão continua valendo onde a sobrescrita é omissa).
 */
export function applyMarketplaceOverrides(
  tenantDefaults: FiscalEmitterSettingsData,
  overrides: MarketplaceBillingOverrides,
): FiscalEmitterSettingsData {
  return mergeEmitterSettingsPatch(tenantDefaults, overrides);
}
