import type { FiscalEmitterSettingsData } from "./fiscal-emitter-settings-types.js";

/** Configuração de numeração inicial por série lógica de NF-e. */
export type NfeNumeracaoSerie = {
  numeroInicial: number;
};

export type NfeNumeracaoSettings = {
  remessa: NfeNumeracaoSerie;
  transferencia: NfeNumeracaoSerie;
};

export type TenantSeriesForNumeracao = {
  serieRemessa: number;
  serieTransferencia: number;
};

export const DEFAULT_NFE_NUMERACAO: NfeNumeracaoSettings = {
  remessa: { numeroInicial: 1 },
  transferencia: { numeroInicial: 1 },
};

/**
 * Calcula o próximo número de NF-e respeitando a última emissão e o piso configurável.
 *
 * - Sem notas emitidas: usa `numeroInicial`.
 * - Com histórico: `max(ultimo + 1, numeroInicial)` — permite pular numeração ao elevar o piso.
 */
export function computeProximoNumeroNfe(
  ultimoEmitido: number | null | undefined,
  numeroInicial: number,
): number {
  const floor = Math.max(1, Math.trunc(numeroInicial) || 1);
  if (ultimoEmitido == null || ultimoEmitido <= 0) return floor;
  return Math.max(ultimoEmitido + 1, floor);
}

/**
 * Resolve o número inicial configurado para a série informada.
 */
export function resolveNumeroInicialNfe(
  settings: FiscalEmitterSettingsData,
  serie: number,
  tenantSeries: TenantSeriesForNumeracao,
): number {
  const numeracao = settings.nfe.numeracao ?? DEFAULT_NFE_NUMERACAO;
  if (serie === tenantSeries.serieTransferencia) {
    return numeracao.transferencia.numeroInicial;
  }
  return numeracao.remessa.numeroInicial;
}
