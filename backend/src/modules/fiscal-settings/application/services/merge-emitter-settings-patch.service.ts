import {
  DEFAULT_FISCAL_EMITTER_SETTINGS,
  mergeFiscalEmitterSettings,
  type FiscalEmitterSettingsData,
} from "../../../../lib/fiscal/fiscal-emitter-settings-defaults.js";
import type { UpdateEmitterSettingsInput } from "../../domain/ports/emitter-settings.repository.js";

/** Merges a partial patch into the current emitter settings snapshot. */
export function mergeEmitterSettingsPatch(
  current: FiscalEmitterSettingsData,
  patch: UpdateEmitterSettingsInput,
): FiscalEmitterSettingsData {
  const { basic, taxes, nfe } = patch;

  return mergeFiscalEmitterSettings({
    basic: { ...current.basic, ...(basic ?? {}) },
    taxes: {
      ...current.taxes,
      ...(taxes ?? {}),
      ...(taxes?.cstDevolucao
        ? { cstDevolucao: { ...current.taxes.cstDevolucao, ...taxes.cstDevolucao } }
        : {}),
      ...(taxes?.composicaoBaseCalculo
        ? {
            composicaoBaseCalculo: {
              ...current.taxes.composicaoBaseCalculo,
              ...taxes.composicaoBaseCalculo,
            },
          }
        : {}),
      ...(taxes?.calculoDifal
        ? {
            calculoDifal: {
              ...current.taxes.calculoDifal,
              ...taxes.calculoDifal,
              porUf: {
                ...current.taxes.calculoDifal.porUf,
                ...((taxes.calculoDifal as { porUf?: Record<string, string> }).porUf ?? {}),
              },
            },
          }
        : {}),
      ...(taxes?.modalidadeFrete
        ? { modalidadeFrete: { ...current.taxes.modalidadeFrete, ...taxes.modalidadeFrete } }
        : {}),
      ...(taxes?.emissaoGnre
        ? { emissaoGnre: { ...current.taxes.emissaoGnre, ...taxes.emissaoGnre } }
        : {}),
    },
    nfe: {
      ...current.nfe,
      ...(nfe ?? {}),
      ...(nfe?.prazoCancelamento
        ? { prazoCancelamento: { ...current.nfe.prazoCancelamento, ...nfe.prazoCancelamento } }
        : {}),
      ...(nfe?.contatos ? { contatos: nfe.contatos } : {}),
    },
  });
}

export { DEFAULT_FISCAL_EMITTER_SETTINGS };
