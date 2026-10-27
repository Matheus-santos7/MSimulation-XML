import type {
  FulfillmentPayloadInput,
  MarketplaceIntermediador,
  NfeTransporta,
} from "./marketplace-fiscal-profile.js";

/** Regras de um marketplace usadas no enriquecimento de remessa, retorno e transferência. */
export type FulfillmentPayloadRules = {
  intermediador: MarketplaceIntermediador | null;
  autXmlCpfsPadrao: readonly string[];
  ibsCbsPadrao: Record<string, unknown> | null;
  transportadorPadrao: NfeTransporta | null;
  /** Ajusta textos que carregam o `idCadIntTran` (ex.: sufixo OLSS do `obsCont` no ML). */
  syncIdCadIntTran?: (payload: Record<string, unknown>, idCadIntTran: string) => void;
};

export type RemessaTranspVol = {
  qVol: number;
  pesoL: number;
  pesoB: number;
};

/** Peso estimado por quantidade (~0,7 kg/un líquido, bruto +1,4%). */
export function estimateRemessaPesoVol(quantidade: number): RemessaTranspVol {
  const pesoL = Math.round(quantidade * 0.7 * 1000) / 1000;
  const pesoB = Math.round(pesoL * 1.014286 * 1000) / 1000;
  return { qVol: quantidade, pesoL, pesoB };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function resolveAutXmlCpfs(
  payload: Record<string, unknown>,
  input: FulfillmentPayloadInput,
  padrao: readonly string[],
): unknown[] {
  const fromInput = input.autXmlCpfs?.filter((c) => c.replace(/\D/g, "").length === 11) ?? null;
  if (fromInput && fromInput.length > 0) return [...fromInput];
  if (Array.isArray(payload.autXmlCpfs) && payload.autXmlCpfs.length > 0) return payload.autXmlCpfs;

  return [...padrao];
}

/**
 * Enriquece o payload fiscal de fulfillment (remessa, retorno, transferência) com os blocos do
 * marketplace: IBS/CBS padrão, `autXML`, `infIntermed`, `transporta` e volumes.
 * Idempotente: não sobrescreve valores já definidos no payload.
 */
export function enrichFulfillmentPayload(
  payload: Record<string, unknown>,
  input: FulfillmentPayloadInput,
  rules: FulfillmentPayloadRules,
): Record<string, unknown> {
  const destIeRaw = input.destIe ?? (typeof payload.destIe === "string" ? payload.destIe : null);
  const destIe = destIeRaw?.replace(/\D/g, "") ?? "";

  const existingIntermed = asRecord(payload.infIntermed);
  const idCadIntTran = rules.intermediador
    ? input.idCadIntTran?.trim() ||
      (typeof existingIntermed?.idCadIntTran === "string" ? existingIntermed.idCadIntTran : null) ||
      rules.intermediador.idCadIntTranPadrao
    : null;

  const out: Record<string, unknown> = {
    ...payload,
    ibsCbs: payload.ibsCbs ?? (rules.ibsCbsPadrao ? { ...rules.ibsCbsPadrao } : undefined),
    autXmlCpfs: resolveAutXmlCpfs(payload, input, rules.autXmlCpfsPadrao),
    ...(rules.intermediador && idCadIntTran
      ? {
          infIntermed: {
            ...existingIntermed,
            cnpj: rules.intermediador.cnpj,
            idCadIntTran,
          },
        }
      : {}),
  };
  if (out.ibsCbs === undefined) delete out.ibsCbs;

  if (destIe && !out.destIe) {
    out.destIe = destIe;
  }

  if (idCadIntTran) rules.syncIdCadIntTran?.(out, idCadIntTran);

  if (input.withLogistics !== false) {
    if (payload.transporta ?? rules.transportadorPadrao) {
      out.transporta = payload.transporta ?? { ...rules.transportadorPadrao };
    }
    const existingTransp = asRecord(payload.transp);
    const estimated = estimateRemessaPesoVol(input.quantidadeTotal);
    out.transp = {
      ...estimated,
      ...existingTransp,
      qVol: existingTransp?.qVol ?? estimated.qVol,
    };
  }

  return out;
}
