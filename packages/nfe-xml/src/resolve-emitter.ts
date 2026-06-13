import {
  buildEmitterSnapshot,
  type EmitterSnapshot,
  type FiscalEmitterSettingsData,
  type NFeTipoValue,
} from "@msimulation-xml/fiscal-core";
import type { NFeTipoXml } from "./types.js";

function defaultModFreteForTipo(tipo: NFeTipoXml): string {
  if (tipo === "REMESSA") return "0";
  if (tipo === "REMESSA_SIMBOLICA") return "2";
  if (tipo === "RETORNO_SIMBOLICO") return "9";
  return "0";
}

export function resolveEmitterFromPayload(
  fiscalPayload: Record<string, unknown> | undefined,
  settings: FiscalEmitterSettingsData | null,
  tipo: NFeTipoXml,
  valor: number,
  valorIcms: number,
): EmitterSnapshot {
  const fromPayload = fiscalPayload?.emitter as EmitterSnapshot | undefined;
  if (fromPayload?.modFrete) return fromPayload;
  if (settings) {
    return buildEmitterSnapshot(settings, tipo as NFeTipoValue, valor, valorIcms, "", "");
  }
  return {
    modFrete: defaultModFreteForTipo(tipo),
    freteNoCalculo: true,
    acrescimoNoProduto: false,
    mensagemInfCpl: "",
    bases: {
      vProd: valor,
      vFrete: 0,
      vDesc: 0,
      vIpi: 0,
      vIcms: valorIcms,
      vBcIcms: valor,
      vBcPisCofins: valor,
      vBcIpi: valor,
    },
    difal: { mode: "PADRAO", aplica: false, vDifal: 0 },
  };
}
