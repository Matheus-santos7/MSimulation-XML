import { roundMoney } from "./venda-ml-round.js";
import {
  ML_INF_RESP_TEC,
  REMESSA_ML_INTERMED_CNPJ,
  REMESSA_ML_INTERMED_ID_DEFAULT,
  type RemessaMlTransporta,
} from "./remessa-ml-payload.js";

/** Transportador nos XMLs ML de venda (modFrete=0, operador logístico). */
export const VENDA_ML_TRANSPORTA: RemessaMlTransporta = {
  cnpj: "03007331012239",
  xNome: "EBAZAR.COM.BR LTDA",
  ie: "120519234116",
  xEnder: "AVENIDA DAS NACOES UNIDAS 3000 3003",
  xMun: "OSASCO",
  uf: "SP",
};

/** CD fulfillment padrão ML (SC) — texto do `<infCpl>` de venda. */
export const VENDA_ML_CD_DEPOSITO = {
  cnpj: "03007331012077",
  ie: "261755994",
  logradouro: "Av. Papenborg",
  numero: "S/N",
  complemento: "",
  bairro: "Guaporanga",
  municipio: "Governador Celso Ramos",
  codigoMunicipio: "4204509",
  cep: "88195900",
  uf: "SC",
  pais: "BR",
} as const;

/** `infRespTec` nos XMLs de venda ML (hashCSRT de produção). */
export const VENDA_ML_INF_RESP_TEC = {
  ...ML_INF_RESP_TEC,
  hashCSRT: "+TuKUMc7ueWv9UiYNVaTD+ym1a4=",
} as const;

export const VENDA_ML_IBS_CBS_DEFAULT = {
  st: "000",
  cClassTrib: "000001",
  pIBSUF: 0.1,
  pIBSMun: 0,
  pCBS: 0.9,
} as const;

export type VendaMlReturnNoteRef = {
  numero: number;
  serie: number;
  emitidaEm: Date | string;
};

export type EnrichMlVendaPayloadInput = {
  quantidade: number;
  valorFrete?: number;
  xPed?: string | null;
  nfci?: string | null;
  autXmlCpfs?: readonly string[] | null;
  vTotTrib?: number | null;
  returnNote?: VendaMlReturnNoteRef | null;
  cardAuthorization?: string | null;
  cdDeposito?: Partial<typeof VENDA_ML_CD_DEPOSITO>;
};

export type VendaEngineTaxSnapshot = {
  vProd: number;
  vFrete?: number;
  vICMS?: number;
  vIPI?: number;
  vPIS?: number;
  vCOFINS?: number;
};

/** Estima IBPT total aproximado quando a planilha não informa (≈32,4% do total operacional). */
export function estimateVendaVTotTrib(snapshot: VendaEngineTaxSnapshot): number {
  const base = (snapshot.vProd ?? 0) + (snapshot.vFrete ?? 0);
  const explicitSum =
    (snapshot.vICMS ?? 0) +
    (snapshot.vIPI ?? 0) +
    (snapshot.vPIS ?? 0) +
    (snapshot.vCOFINS ?? 0);
  if (explicitSum > 0 && base > 0) {
    return roundMoney(Math.max(explicitSum * 1.08, base * 0.324));
  }
  return roundMoney(base * 0.324);
}

export function buildVendaInfAdProdText(xPed: string, vTotTrib: number): string {
  const pedido = xPed.trim();
  const ibpt = vTotTrib.toFixed(2).replace(".", ",");
  return pedido
    ? `xPed:${pedido} Total aproximado de tributos federais, estaduais e municipais: R$${ibpt}`
    : `Total aproximado de tributos federais, estaduais e municipais: R$${ibpt}`;
}

function formatBrDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function buildVendaInfCplText(
  vTotTrib: number,
  returnNote?: VendaMlReturnNoteRef | null,
  cd: Partial<typeof VENDA_ML_CD_DEPOSITO> = {},
  difal?: { vICMSUFDest?: number; vFCPUFDest?: number; vICMSUFRemet?: number },
): string {
  const dep = { ...VENDA_ML_CD_DEPOSITO, ...cd };
  const ibpt = vTotTrib.toFixed(2).replace(".", ",");
  const retornoPart = returnNote
    ? ` Nota fiscal de retorno simbolico n ${returnNote.numero}, emitida em ${formatBrDate(returnNote.emitidaEm)}, serie ${returnNote.serie}.`
    : "";
  const vDifalDest = (difal?.vICMSUFDest ?? 0).toFixed(2).replace(".", ",");
  const vFcpDest = (difal?.vFCPUFDest ?? 0).toFixed(2).replace(".", ",");
  const vDifalOrig = (difal?.vICMSUFRemet ?? 0).toFixed(2).replace(".", ",");
  return (
    `Enviado diretamente do deposito temporario - operador logistico: EBAZAR.COM.BR LTDA, Cnpj: ${dep.cnpj}, Inscricao Estadual: ${dep.ie}, saindo do endereco: ${dep.logradouro}, Numero: ${dep.numero}, Complemento: ${dep.complemento}, Bairro: ${dep.bairro}, Cidade: ${dep.municipio}, Cep: ${dep.cep}, Estado: ${dep.uf}, Pais: ${dep.pais}.${retornoPart} Valor aproximado dos tributos (IBPT) R$${ibpt}. Valores totais do ICMS Interestadual: DIFAL da UF destino R$${vDifalDest} + FCP R$${vFcpDest}; DIFAL da UF Origem R$${vDifalOrig}. N/A ${ibpt.replace(",", ".")} 0,00`
  );
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Enriquece payload fiscal da NF-e de venda com blocos presentes nos XMLs ML reais.
 */
export function enrichFiscalPayloadMlVenda(
  payload: Record<string, unknown>,
  input: EnrichMlVendaPayloadInput,
): Record<string, unknown> {
  const engine = asRecord(payload.engine);
  const totais = asRecord(engine?.totais);
  const item = Array.isArray(engine?.itens) ? asRecord(engine!.itens[0]) : null;
  const icms = asRecord(item?.icms);
  const ipi = asRecord(item?.ipi);
  const pis = asRecord(item?.pis);
  const cofins = asRecord(item?.cofins);

  const taxSnapshot: VendaEngineTaxSnapshot = {
    vProd: Number(totais?.vProd ?? item?.vProd ?? 0),
    vFrete: Number(totais?.vFrete ?? item?.vFrete ?? input.valorFrete ?? 0),
    vICMS: Number(totais?.vICMS ?? icms?.vICMS ?? 0),
    vIPI: Number(totais?.vIPI ?? ipi?.vIPI ?? 0),
    vPIS: Number(totais?.vPIS ?? pis?.vPIS ?? 0),
    vCOFINS: Number(totais?.vCOFINS ?? cofins?.vCOFINS ?? 0),
  };
  const difal = asRecord(item?.difal);
  const difalTotais = {
    vICMSUFDest: Number(totais?.vICMSUFDest ?? difal?.vICMSUFDest ?? 0),
    vFCPUFDest: Number(totais?.vFCPUFDest ?? difal?.vFCPUFDest ?? 0),
    vICMSUFRemet: Number(totais?.vICMSUFRemet ?? difal?.vICMSUFRemet ?? 0),
  };

  const vTotTrib =
    input.vTotTrib != null && Number.isFinite(input.vTotTrib)
      ? roundMoney(input.vTotTrib)
      : estimateVendaVTotTrib(taxSnapshot);

  const xPed = input.xPed?.trim() || (typeof payload.xPed === "string" ? payload.xPed : "");
  const autXmlFromInput =
    input.autXmlCpfs?.filter((c) => c.replace(/\D/g, "").length === 11) ?? null;

  const existingIntermed = asRecord(payload.infIntermed);
  const pesoL = Math.round(input.quantidade * 22.9 * 1000) / 1000;
  const pesoB = Math.round(input.quantidade * 24.7 * 1000) / 1000;

  return {
    ...payload,
    ibsCbs: payload.ibsCbs ?? { ...VENDA_ML_IBS_CBS_DEFAULT },
    transporta: payload.transporta ?? { ...VENDA_ML_TRANSPORTA },
    transp: payload.transp ?? { qVol: input.quantidade, pesoL, pesoB },
    vTotTrib,
    infAdProd: buildVendaInfAdProdText(xPed, vTotTrib),
    infCplVenda: buildVendaInfCplText(vTotTrib, input.returnNote, input.cdDeposito, difalTotais),
    pagamento: {
      tPag: "03",
      card: {
        tpIntegra: "1",
        cnpj: REMESSA_ML_INTERMED_CNPJ,
        tBand: "01",
        cAut: input.cardAuthorization?.trim() || "837812",
      },
    },
    ...(autXmlFromInput?.length ? { autXmlCpfs: [...autXmlFromInput] } : {}),
    ...(input.nfci ? { nfci: input.nfci } : {}),
    ...(xPed ? { xPed } : {}),
    infIntermed: {
      ...existingIntermed,
      cnpj: REMESSA_ML_INTERMED_CNPJ,
      idCadIntTran:
        (typeof existingIntermed?.idCadIntTran === "string" && existingIntermed.idCadIntTran) ||
        REMESSA_ML_INTERMED_ID_DEFAULT,
    },
  };
}
