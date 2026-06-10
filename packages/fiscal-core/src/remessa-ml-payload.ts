/**
 * Dados logísticos e de intermediário ML para `fiscalPayload` na emissão.
 * Fonte única para backend (persistência) e nfe-xml (leitura no XML).
 */

export const REMESSA_ML_INTERMED_CNPJ = "03007331000141";
export const REMESSA_ML_INTERMED_ID_DEFAULT = "279642028";

export const REMESSA_AUT_XML_CPFS = ["87659808915", "72556455772"] as const;

/** Responsável técnico ML — bloco `infRespTec` nos XMLs de fulfillment. */
export const ML_INF_RESP_TEC = {
  cnpj: REMESSA_ML_INTERMED_CNPJ,
  xContato: "EBAZAR.COM.BR. LTDA",
  email: "fiscal@mercadolivre.com",
  fone: "1125434155",
  idCSRT: "01",
  hashCSRT: "4ET98v7L2eZzffy/WSCSTlYq+N4=",
} as const;

export const REMESSA_IBS_CBS_DEFAULT = {
  st: "410",
  cClassTrib: "410999",
} as const;

export type RemessaMlTransporta = {
  cnpj: string;
  ie: string;
  xNome: string;
  xEnder: string;
  xMun: string;
  uf: string;
};

/** Transportador terceiro ML (modFrete=2) — padrão dos XMLs de remessa em produção. */
export const REMESSA_ML_TRANSPORTA_DEFAULT: RemessaMlTransporta = {
  cnpj: "03007331012239",
  ie: "120519234116",
  xNome: "EBAZAR.COM.BR LTDA",
  xEnder: "AVENIDA DAS NACOES UNIDAS 3000 3003",
  xMun: "OSASCO",
  uf: "SP",
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
  return { qVol: 1, pesoL, pesoB };
}

export type EnrichMlFulfillmentPayloadInput = {
  quantidadeTotal: number;
  destIe?: string | null;
  idCadIntTran?: string | null;
  /** CPFs do bloco `autXML` — quando omitido, usa `REMESSA_AUT_XML_CPFS`. */
  autXmlCpfs?: readonly string[] | null;
  /** Inclui `transporta` + `transp` (remessa física e simbólica outbound). */
  withLogistics?: boolean;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Enriquece o payload fiscal com blocos presentes nos XMLs ML reais de fulfillment.
 * Idempotente: não sobrescreve valores já definidos no payload.
 */
export function enrichFiscalPayloadMlFulfillment(
  payload: Record<string, unknown>,
  input: EnrichMlFulfillmentPayloadInput,
): Record<string, unknown> {
  const destIeRaw =
    input.destIe ??
    (typeof payload.destIe === "string" ? payload.destIe : null);
  const destIe = destIeRaw?.replace(/\D/g, "") ?? "";

  const existingIntermed = asRecord(payload.infIntermed);
  const idCadIntTran =
    input.idCadIntTran?.trim() ||
    (typeof existingIntermed?.idCadIntTran === "string" ? existingIntermed.idCadIntTran : null) ||
    REMESSA_ML_INTERMED_ID_DEFAULT;

  const autXmlFromInput =
    input.autXmlCpfs?.filter((c) => c.replace(/\D/g, "").length === 11) ?? null;
  const autXmlCpfs =
    autXmlFromInput && autXmlFromInput.length > 0
      ? [...autXmlFromInput]
      : Array.isArray(payload.autXmlCpfs) && payload.autXmlCpfs.length > 0
        ? payload.autXmlCpfs
        : [...REMESSA_AUT_XML_CPFS];

  const out: Record<string, unknown> = {
    ...payload,
    ibsCbs: payload.ibsCbs ?? { ...REMESSA_IBS_CBS_DEFAULT },
    autXmlCpfs,
    infIntermed: {
      ...existingIntermed,
      cnpj: REMESSA_ML_INTERMED_CNPJ,
      idCadIntTran,
    },
  };

  if (destIe && !out.destIe) {
    out.destIe = destIe;
  }

  if (input.withLogistics !== false) {
    out.transporta = payload.transporta ?? { ...REMESSA_ML_TRANSPORTA_DEFAULT };
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
