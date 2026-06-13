/**
 * Resolve alíquotas de fallback (fonte secundária) a partir de {@link FiscalEmitterSettingsData}.
 *
 * Prioridade: planilha (`ResolvedTaxRule`) → settings do emissor → tabela Convênio/hardcode legado.
 */

import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";
import {
  DEFAULT_ICMS_FALLBACK_RATES,
  DEFAULT_PIS_COFINS_RATES,
} from "../../../fiscal-settings/domain/services/fiscal-emitter-settings-defaults.js";

export type IcmsFallbackOperation = "sale" | "inbound";

function isIntraState(emitUf: string, destUf: string): boolean {
  return emitUf.toUpperCase() === destUf.toUpperCase();
}

/**
 * Tabela simplificada interestadual (Convênio ICMS) — último recurso para venda.
 */
export function defaultInterstateConvenioRate(originUf: string, destinationUf: string): number {
  const o = originUf.toUpperCase();
  const d = destinationUf.toUpperCase();
  if (o === d) return 0;
  const southSoutheast = new Set(["SP", "RJ", "MG", "PR", "SC", "RS"]);
  const northNortheastCenterWestEs = new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "ES", "GO", "MA", "MT", "MS",
    "PA", "PB", "PE", "PI", "RN", "RO", "RR", "SE", "TO", "DF",
  ]);
  if (southSoutheast.has(o) && northNortheastCenterWestEs.has(d)) return 7;
  return 12;
}

/**
 * Alíquota ICMS de reserva quando a planilha não informa o percentual.
 *
 * @param emitUf - UF do emitente
 * @param destUf - UF do destinatário
 * @param operation - `sale` (venda/devolução) ou `inbound` (remessa/retorno)
 * @param settings - Configurações gerais do emissor (`FiscalEmitterSettings`)
 */
export function resolveIcmsFallbackRate(
  emitUf: string,
  destUf: string,
  operation: IcmsFallbackOperation,
  settings?: FiscalEmitterSettingsData | null,
): number {
  const rates = settings?.taxes.defaultIcmsRates ?? DEFAULT_ICMS_FALLBACK_RATES;
  if (isIntraState(emitUf, destUf)) return rates.intra;
  if (operation === "inbound") return rates.interInbound;
  return rates.interSale;
}

/**
 * Alíquota interestadual para venda quando não há regra — usa Convênio ICMS.
 */
export function resolveInterstateSaleFallbackRate(
  emitUf: string,
  destUf: string,
  settings?: FiscalEmitterSettingsData | null,
): number {
  if (isIntraState(emitUf, destUf)) {
    return (settings?.taxes.defaultIcmsRates ?? DEFAULT_ICMS_FALLBACK_RATES).intra;
  }
  return defaultInterstateConvenioRate(emitUf, destUf);
}

/** Alíquotas PIS/COFINS de reserva quando a planilha não informa. */
export function resolvePisCofinsFallbackRates(settings?: FiscalEmitterSettingsData | null): {
  pis: number;
  cofins: number;
} {
  return settings?.taxes.defaultPisCofins ?? DEFAULT_PIS_COFINS_RATES;
}

/** @deprecated Use {@link resolveIcmsFallbackRate} com `operation: "inbound"`. */
export function inferIcmsRateForShipment(
  emitUf: string,
  destUf: string,
  settings?: FiscalEmitterSettingsData | null,
): number {
  return resolveIcmsFallbackRate(emitUf, destUf, "inbound", settings);
}

/** @deprecated Use {@link resolveInterstateSaleFallbackRate}. */
export function inferIntraStateIcmsRate(
  emitUf: string,
  destUf: string,
  settings?: FiscalEmitterSettingsData | null,
): number {
  return resolveInterstateSaleFallbackRate(emitUf, destUf, settings);
}

/** @deprecated Use {@link resolveIcmsFallbackRate} com `operation: "sale"`. */
export function inferIcmsRateForSale(
  emitUf: string,
  destUf: string,
  settings?: FiscalEmitterSettingsData | null,
): number {
  return resolveIcmsFallbackRate(emitUf, destUf, "sale", settings);
}
