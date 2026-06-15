/**
 * Resolve alíquotas de fallback (fonte secundária) a partir de {@link FiscalEmitterSettingsData}.
 *
 * Prioridade: planilha (`ResolvedTaxRule`) → settings do emissor → tabela Senado/Convênio.
 */

import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";
import {
  DEFAULT_ICMS_FALLBACK_RATES,
  DEFAULT_PIS_COFINS_RATES,
} from "../../../fiscal-settings/domain/services/fiscal-emitter-settings-defaults.js";

export type IcmsFallbackOperation = "sale" | "inbound";

/** Sul/Sudeste exceto Espírito Santo — origem elegível à alíquota de 7% (Resolução Senado). */
const SOUTH_SOUTHEAST_ORIGIN_UFS = new Set(["PR", "RS", "SC", "MG", "RJ", "SP"]);

/** Norte, Nordeste, Centro-Oeste e Espírito Santo — destino elegível à alíquota de 7%. */
const NORTH_NORTHEAST_CENTER_WEST_ES_DEST_UFS = new Set([
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "PA", "PB", "PE", "PI", "RN", "RO", "RR", "SE", "TO",
]);

/** Origens importadas — alíquota interestadual fixa de 4% (Resolução do Senado 13/2012). */
const IMPORTED_PRODUCT_ORIGINS = new Set([1, 2, 3, 8]);

function isIntraState(emitUf: string, destUf: string): boolean {
  return emitUf.toUpperCase() === destUf.toUpperCase();
}

/**
 * Normaliza a origem da mercadoria (tag `<orig>`) para inteiro 0–8.
 * Aceita número ou string numérica.
 */
export function normalizeProductOrigin(origemProduto: string | number | null | undefined): number {
  if (origemProduto == null || origemProduto === "") return 0;
  if (typeof origemProduto === "number" && Number.isFinite(origemProduto)) {
    return Math.trunc(origemProduto);
  }
  const parsed = Number(String(origemProduto).trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

/**
 * Fallback seguro de alíquota ICMS interestadual fixada pelo Senado Federal.
 *
 * Aplica-se quando não há alíquota configurada na planilha/regra e o CST exige
 * tributação própria (ex.: CST 00), evitando `pICMS` zerado em operação interestadual.
 *
 * @returns Alíquota (4, 7 ou 12) ou `null` se a operação for intraestadual.
 */
export function resolveInterstateIcmsFallback(
  ufOrigem: string,
  ufDestino: string,
  origemProduto: string | number | null | undefined,
): number | null {
  const originUf = ufOrigem.trim().toUpperCase();
  const destUf = ufDestino.trim().toUpperCase();

  if (originUf.length !== 2 || destUf.length !== 2) return null;
  if (originUf === destUf) return null;

  const productOrigin = normalizeProductOrigin(origemProduto);

  if (IMPORTED_PRODUCT_ORIGINS.has(productOrigin)) return 4;

  if (SOUTH_SOUTHEAST_ORIGIN_UFS.has(originUf) && NORTH_NORTHEAST_CENTER_WEST_ES_DEST_UFS.has(destUf)) {
    return 7;
  }

  return 12;
}

/**
 * Tabela simplificada interestadual (Convênio ICMS) — último recurso sem origem do produto.
 * @deprecated Prefira {@link resolveInterstateIcmsFallback} quando a origem estiver disponível.
 */
export function defaultInterstateConvenioRate(originUf: string, destinationUf: string): number {
  return resolveInterstateIcmsFallback(originUf, destinationUf, 0) ?? 0;
}

/**
 * Alíquota ICMS de reserva quando a planilha não informa o percentual.
 *
 * @param emitUf - UF do emitente
 * @param destUf - UF do destinatário
 * @param operation - `sale` (venda/devolução) ou `inbound` (remessa/retorno)
 * @param settings - Configurações gerais do emissor (`FiscalEmitterSettings`)
 * @param origemProduto - Origem da mercadoria para fallback Senado em operação interestadual
 */
export function resolveIcmsFallbackRate(
  emitUf: string,
  destUf: string,
  operation: IcmsFallbackOperation,
  settings?: FiscalEmitterSettingsData | null,
  origemProduto?: string | number | null,
): number {
  const rates = settings?.taxes.defaultIcmsRates ?? DEFAULT_ICMS_FALLBACK_RATES;
  if (isIntraState(emitUf, destUf)) return rates.intra;

  if (operation === "sale") {
    const senateFallback = resolveInterstateIcmsFallback(emitUf, destUf, origemProduto);
    if (senateFallback != null) return senateFallback;
  }

  if (operation === "inbound") return rates.interInbound;
  return rates.interSale;
}

/**
 * Alíquota interestadual para venda quando não há regra — usa tabela Senado/Convênio.
 */
export function resolveInterstateSaleFallbackRate(
  emitUf: string,
  destUf: string,
  settings?: FiscalEmitterSettingsData | null,
  origemProduto?: string | number | null,
): number {
  if (isIntraState(emitUf, destUf)) {
    return (settings?.taxes.defaultIcmsRates ?? DEFAULT_ICMS_FALLBACK_RATES).intra;
  }
  return resolveInterstateIcmsFallback(emitUf, destUf, origemProduto) ?? defaultInterstateConvenioRate(emitUf, destUf);
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
  origemProduto?: string | number | null,
): number {
  return resolveIcmsFallbackRate(emitUf, destUf, "inbound", settings, origemProduto);
}

/** @deprecated Use {@link resolveInterstateSaleFallbackRate}. */
export function inferIntraStateIcmsRate(
  emitUf: string,
  destUf: string,
  settings?: FiscalEmitterSettingsData | null,
  origemProduto?: string | number | null,
): number {
  return resolveInterstateSaleFallbackRate(emitUf, destUf, settings, origemProduto);
}

/** @deprecated Use {@link resolveIcmsFallbackRate} com `operation: "sale"`. */
export function inferIcmsRateForSale(
  emitUf: string,
  destUf: string,
  settings?: FiscalEmitterSettingsData | null,
  origemProduto?: string | number | null,
): number {
  return resolveIcmsFallbackRate(emitUf, destUf, "sale", settings, origemProduto);
}
