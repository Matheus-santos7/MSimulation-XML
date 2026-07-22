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
 * Avança o candidato para o primeiro número livre após faixas inutilizadas (`procInutNFe`).
 * Faixas sobrepostas ou adjacentes são atravessadas em loop até estabilizar.
 */
export function advancePastInutilizedRanges(
  candidate: number,
  ranges: ReadonlyArray<{ numeroIni: number; numeroFim: number }> = [],
): number {
  let n = Math.max(1, Math.trunc(candidate) || 1);
  if (ranges.length === 0) return n;

  let changed = true;
  while (changed) {
    changed = false;
    for (const range of ranges) {
      const ini = Math.min(range.numeroIni, range.numeroFim);
      const fim = Math.max(range.numeroIni, range.numeroFim);
      if (n >= ini && n <= fim) {
        n = fim + 1;
        changed = true;
      }
    }
  }
  return n;
}

/**
 * Calcula o próximo número de NF-e respeitando a última emissão, o piso configurável
 * e faixas inutilizadas (quando informadas).
 *
 * - Sem notas emitidas: usa `numeroInicial`.
 * - Com histórico: `max(ultimo + 1, numeroInicial)` — permite pular numeração ao elevar o piso.
 * - Com inutilizações: salta qualquer número coberto por `nNFIni`…`nNFFin`.
 */
export function computeProximoNumeroNfe(
  ultimoEmitido: number | null | undefined,
  numeroInicial: number,
  inutilizacoes: ReadonlyArray<{ numeroIni: number; numeroFim: number }> = [],
): number {
  const floor = Math.max(1, Math.trunc(numeroInicial) || 1);
  const base =
    ultimoEmitido == null || ultimoEmitido <= 0
      ? floor
      : Math.max(ultimoEmitido + 1, floor);
  return advancePastInutilizedRanges(base, inutilizacoes);
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
