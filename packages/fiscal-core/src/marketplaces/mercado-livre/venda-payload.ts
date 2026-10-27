import { buildFulfillmentInfCplText } from "../../infcpl/fulfillment-infcpl.js";
import { roundMoney } from "../../venda-ml-round.js";
import type {
  VendaPayloadInput,
  VendaReturnNoteDestinatario,
  VendaReturnNoteRef,
} from "../marketplace-fiscal-profile.js";
import { ML_CD_DEPOSITO_PADRAO } from "./armazem.js";
import { ML_ID_CAD_INT_TRAN_PADRAO, ML_INTERMEDIADOR_CNPJ } from "./intermediador.js";
import { ML_TRANSPORTADOR_VENDA } from "./transporte.js";
import { ML_IBS_CBS_VENDA } from "./tributos.js";

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
    (snapshot.vICMS ?? 0) + (snapshot.vIPI ?? 0) + (snapshot.vPIS ?? 0) + (snapshot.vCOFINS ?? 0);
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

type ResolvedInfCplDeposito = {
  xNome: string;
  cnpj: string;
  ie: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  cep: string;
  uf: string;
  pais: string;
};

/**
 * Resolve os dados do CD operador logístico para o texto do `<infCpl>` da venda.
 *
 * Fonte primária: destinatário da NF-e de retorno simbólico que faz par com a
 * venda (mesmo CD da remessa FIFO referenciada). Fallback: {@link ML_CD_DEPOSITO_PADRAO}.
 */
function resolveInfCplDeposito(destinatario?: VendaReturnNoteDestinatario): ResolvedInfCplDeposito {
  const pickText = (incoming: string | null | undefined, fallback: string): string => {
    const cleaned = incoming?.trim();
    return cleaned ? cleaned : fallback;
  };
  const pickDigits = (incoming: string | null | undefined, fallback: string): string => {
    const digits = incoming ? incoming.replace(/\D/g, "") : "";
    return digits || fallback;
  };
  return {
    xNome: pickText(destinatario?.xNome, ML_CD_DEPOSITO_PADRAO.xNome),
    cnpj: pickDigits(destinatario?.cnpj, ML_CD_DEPOSITO_PADRAO.cnpj),
    ie: pickDigits(destinatario?.ie, ML_CD_DEPOSITO_PADRAO.ie),
    logradouro: pickText(destinatario?.logradouro, ML_CD_DEPOSITO_PADRAO.logradouro),
    numero: pickText(destinatario?.numero, ML_CD_DEPOSITO_PADRAO.numero),
    complemento: destinatario?.complemento?.trim() ?? ML_CD_DEPOSITO_PADRAO.complemento,
    bairro: pickText(destinatario?.bairro, ML_CD_DEPOSITO_PADRAO.bairro),
    municipio: pickText(destinatario?.municipio, ML_CD_DEPOSITO_PADRAO.municipio),
    cep: pickDigits(destinatario?.cep, ML_CD_DEPOSITO_PADRAO.cep),
    uf: pickText(destinatario?.uf, ML_CD_DEPOSITO_PADRAO.uf),
    pais: pickText(destinatario?.pais, ML_CD_DEPOSITO_PADRAO.pais),
  };
}

/**
 * Miolo do `<infCpl>` da venda ML Full (CD + retorno + IBPT + DIFAL).
 * A abertura da operação e o regime especial são compostos por
 * {@link buildFulfillmentInfCplText}.
 */
export function buildVendaInfCplMiddle(
  vTotTrib: number,
  returnNote?: VendaReturnNoteRef | null,
  difal?: { vICMSUFDest?: number; vFCPUFDest?: number; vICMSUFRemet?: number },
): string {
  const dep = resolveInfCplDeposito(returnNote?.destinatario);
  const ibpt = vTotTrib.toFixed(2).replace(".", ",");
  const retornoPart = returnNote
    ? ` Nota fiscal de retorno simbolico n ${returnNote.numero}, emitida em ${formatBrDate(returnNote.emitidaEm)}, serie ${returnNote.serie}.`
    : "";
  const vDifalDest = (difal?.vICMSUFDest ?? 0).toFixed(2).replace(".", ",");
  const vFcpDest = (difal?.vFCPUFDest ?? 0).toFixed(2).replace(".", ",");
  const vDifalOrig = (difal?.vICMSUFRemet ?? 0).toFixed(2).replace(".", ",");
  return `Enviado diretamente do deposito temporario - operador logistico: ${dep.xNome}, Cnpj: ${dep.cnpj}, Inscricao Estadual: ${dep.ie}, saindo do endereco: ${dep.logradouro}, Numero: ${dep.numero}, Complemento: ${dep.complemento}, Bairro: ${dep.bairro}, Cidade: ${dep.municipio}, Cep: ${dep.cep}, Estado: ${dep.uf}, Pais: ${dep.pais}.${retornoPart} Valor aproximado dos tributos (IBPT) R$${ibpt}. Valores totais do ICMS Interestadual: DIFAL da UF destino R$${vDifalDest} + FCP R$${vFcpDest}; DIFAL da UF Origem R$${vDifalOrig}. N/A ${ibpt.replace(",", ".")} 0,00`;
}

/**
 * Monta o `<infCpl>` completo da venda fulfillment (head + miolo + regime do CD).
 */
export function buildVendaInfCplText(
  vTotTrib: number,
  returnNote?: VendaReturnNoteRef | null,
  difal?: { vICMSUFDest?: number; vFCPUFDest?: number; vICMSUFRemet?: number },
): string {
  const dep = resolveInfCplDeposito(returnNote?.destinatario);
  return buildFulfillmentInfCplText({
    operation: "VENDA_FULFILLMENT",
    ufDestino: dep.uf,
    cnpjFilial: dep.cnpj,
    middle: buildVendaInfCplMiddle(vTotTrib, returnNote, difal),
  });
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Enriquece payload fiscal da NF-e de venda com blocos presentes nos XMLs ML reais.
 */
export function enrichMercadoLivreVendaPayload(
  payload: Record<string, unknown>,
  input: VendaPayloadInput,
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
    ibsCbs: payload.ibsCbs ?? { ...ML_IBS_CBS_VENDA },
    transporta: payload.transporta ?? { ...ML_TRANSPORTADOR_VENDA },
    transp: payload.transp ?? { qVol: input.quantidade, pesoL, pesoB },
    vTotTrib,
    infAdProd: buildVendaInfAdProdText(xPed, vTotTrib),
    infCplVenda: buildVendaInfCplText(vTotTrib, input.returnNote, difalTotais),
    pagamento: {
      tPag: "03",
      card: {
        tpIntegra: "1",
        cnpj: ML_INTERMEDIADOR_CNPJ,
        tBand: "01",
        cAut: input.cardAuthorization?.trim() || "837812",
      },
    },
    ...(autXmlFromInput?.length ? { autXmlCpfs: [...autXmlFromInput] } : {}),
    ...(input.nfci ? { nfci: input.nfci } : {}),
    ...(xPed ? { xPed } : {}),
    infIntermed: {
      ...existingIntermed,
      cnpj: ML_INTERMEDIADOR_CNPJ,
      idCadIntTran:
        (typeof existingIntermed?.idCadIntTran === "string" && existingIntermed.idCadIntTran) ||
        ML_ID_CAD_INT_TRAN_PADRAO,
    },
  };
}
