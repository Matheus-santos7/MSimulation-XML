/**
 * Blocos XML NF-e v4.00 reutilizáveis entre remessa, venda e demais tipos.
 * Centraliza formatação alinhada aos XMLs reais do Mercado Livre.
 */

import {
  estimateRemessaPesoVol,
  REMESSA_AUT_XML_CPFS,
  REMESSA_IBS_CBS_DEFAULT,
  type RemessaMlTransporta,
} from "@msimulation-xml/fiscal-core";
import type { IcmsTotInput } from "./fiscal-engine-xml.js";

export type IcmsTotValues = IcmsTotInput;

export type NfeTransportaInput = RemessaMlTransporta;

export type NfeTranspVolInput = {
  qVol?: number;
  pesoL: number;
  pesoB: number;
};

export type IbsCbsDefaults = {
  cst: string;
  cClassTrib: string;
};

export const REMESSA_IBS_CBS_DEFAULTS: IbsCbsDefaults = {
  cst: REMESSA_IBS_CBS_DEFAULT.st,
  cClassTrib: REMESSA_IBS_CBS_DEFAULT.cClassTrib,
};

export const VENDA_IBS_CBS_DEFAULTS: IbsCbsDefaults = {
  cst: "000",
  cClassTrib: "000001",
};

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function asNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Quantidade no padrão ML: inteiros sem casas decimais; demais com 4 casas. */
export function formatNfeQuantity(q: number): string {
  const rounded = Math.round(q * 10000) / 10000;
  if (Math.abs(rounded - Math.trunc(rounded)) < 1e-9) return String(Math.trunc(rounded));
  return rounded.toFixed(4);
}

/** IPI não tributado — remessa ML: cEnq 999, CST 53. */
export function impostoIpiRemessaXml(): string {
  return impostoIpiIntXml("53", "999");
}

export function impostoIpiIntXml(cst = "55", cEnq = "103"): string {
  return `<IPI>
            <cEnq>${cEnq}</cEnq>
            <IPINT><CST>${cst}</CST></IPINT>
          </IPI>`;
}

function ibsCbsImpostoXml(
  ibsCbs: Record<string, unknown> | null | undefined,
  defaults: IbsCbsDefaults,
  alwaysEmit: boolean,
): string {
  const hasExplicit =
    !!ibsCbs && (ibsCbs.st != null || ibsCbs.cst != null || ibsCbs.cClassTrib != null);
  if (!alwaysEmit && !hasExplicit) return "";
  const cst = String(ibsCbs?.st ?? ibsCbs?.cst ?? defaults.cst).slice(0, 3);
  const cClassTrib = String(ibsCbs?.cClassTrib ?? defaults.cClassTrib).slice(0, 6);
  return `<IBSCBS><CST>${cst}</CST><cClassTrib>${cClassTrib}</cClassTrib></IBSCBS>`;
}

/** Venda: emite IBSCBS apenas quando o payload traz dados. */
export function ibsCbsImpostoXmlFromPayload(ibsCbs?: Record<string, unknown> | null): string {
  return ibsCbsImpostoXml(ibsCbs, VENDA_IBS_CBS_DEFAULTS, false);
}

/** Remessa: sempre emite IBSCBS (padrão ML reforma tributária). */
export function ibsCbsImpostoXmlRemessa(ibsCbs?: Record<string, unknown> | null): string {
  return ibsCbsImpostoXml(ibsCbs, REMESSA_IBS_CBS_DEFAULTS, true);
}

export function vItemXml(vItem: number): string {
  return `\n        <vItem>${vItem.toFixed(2)}</vItem>`;
}

export function icmsTotXml(t: IcmsTotValues, opts?: { includeDifalFields?: boolean }): string {
  const includeDifal = opts?.includeDifalFields ?? false;
  const hasDifalValues =
    (t.vFCPUFDest ?? 0) !== 0 || (t.vICMSUFDest ?? 0) !== 0 || (t.vICMSUFRemet ?? 0) !== 0;
  const difal =
    includeDifal || hasDifalValues
      ? `<vFCPUFDest>${(t.vFCPUFDest ?? 0).toFixed(2)}</vFCPUFDest>
          <vICMSUFDest>${(t.vICMSUFDest ?? 0).toFixed(2)}</vICMSUFDest>
          <vICMSUFRemet>${(t.vICMSUFRemet ?? 0).toFixed(2)}</vICMSUFRemet>`
      : "";
  return `<ICMSTot>
          <vBC>${t.vBC.toFixed(2)}</vBC>
          <vICMS>${t.vICMS.toFixed(2)}</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          ${difal}
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${t.vProd.toFixed(2)}</vProd>
          <vFrete>${t.vFrete.toFixed(2)}</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>${t.vIPI.toFixed(2)}</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>${t.vPIS.toFixed(2)}</vPIS>
          <vCOFINS>${t.vCOFINS.toFixed(2)}</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${t.vNF.toFixed(2)}</vNF>
          <vTotTrib>0.00</vTotTrib>
        </ICMSTot>`;
}

export function ibsCbsTotXml(vBCIBSCBS = 0): string {
  return `<IBSCBSTot>
          <vBCIBSCBS>${vBCIBSCBS.toFixed(2)}</vBCIBSCBS>
        </IBSCBSTot>`;
}

export function vNFTotXml(vNF: number): string {
  return `<vNFTot>${vNF.toFixed(2)}</vNFTot>`;
}

export function nfeTotalXml(
  icmsTot: string,
  vNF: number,
  opts?: { includeReformaTributaria?: boolean; vBCIBSCBS?: number },
): string {
  const reforma =
    opts?.includeReformaTributaria !== false
      ? `\n        ${ibsCbsTotXml(opts?.vBCIBSCBS ?? 0)}\n        ${vNFTotXml(vNF)}`
      : "";
  return `${icmsTot}${reforma}`;
}

export function transportaXml(t: NfeTransportaInput): string {
  return `        <transporta>
          <CNPJ>${t.cnpj.replace(/\D/g, "")}</CNPJ>
          <xNome>${xmlEscape(t.xNome)}</xNome>
          <IE>${t.ie.replace(/\D/g, "")}</IE>
          <xEnder>${xmlEscape(t.xEnder)}</xEnder>
          <xMun>${xmlEscape(t.xMun)}</xMun>
          <UF>${t.uf}</UF>
        </transporta>`;
}

export function nfeTranspXml(opts: {
  modFrete: string;
  transporta?: NfeTransportaInput | null;
  vol: NfeTranspVolInput;
}): string {
  const transportaBlock =
    opts.modFrete === "2" && opts.transporta ? `\n${transportaXml(opts.transporta)}` : "";
  const qVol = opts.vol.qVol ?? 1;
  return `      <transp>
        <modFrete>${opts.modFrete}</modFrete>${transportaBlock}
        <vol>
          <qVol>${qVol}</qVol>
          <pesoL>${opts.vol.pesoL.toFixed(3)}</pesoL>
          <pesoB>${opts.vol.pesoB.toFixed(3)}</pesoB>
        </vol>
      </transp>`;
}

/** Lê `fiscalPayload.transp` ou estima pelo mesmo algoritmo do backend. */
export function resolveRemessaTranspVol(
  quantidade: number,
  fiscal?: Record<string, unknown>,
): NfeTranspVolInput {
  const transp = fiscal?.transp as Record<string, unknown> | undefined;
  const estimated = estimateRemessaPesoVol(quantidade);
  return {
    qVol: asNum(transp?.qVol, estimated.qVol),
    pesoL: asNum(transp?.pesoL, estimated.pesoL),
    pesoB: asNum(transp?.pesoB, estimated.pesoB),
  };
}

export function resolveTransportaFromFiscal(
  fiscal: Record<string, unknown> | undefined,
  fallback: NfeTransportaInput,
): NfeTransportaInput {
  const raw = fiscal?.transporta as Record<string, unknown> | undefined;
  if (!raw) return fallback;
  return {
    cnpj: String(raw.cnpj ?? fallback.cnpj),
    ie: String(raw.ie ?? fallback.ie),
    xNome: String(raw.xNome ?? fallback.xNome),
    xEnder: String(raw.xEnder ?? fallback.xEnder),
    xMun: String(raw.xMun ?? fallback.xMun),
    uf: String(raw.uf ?? fallback.uf),
  };
}

export function resolveAutXmlCpfs(
  fiscal: Record<string, unknown> | undefined,
  fallback: readonly string[] = REMESSA_AUT_XML_CPFS,
): readonly string[] {
  const fromPayload = fiscal?.autXmlCpfs;
  if (Array.isArray(fromPayload) && fromPayload.length > 0 && fromPayload.every((c) => typeof c === "string")) {
    return fromPayload as string[];
  }
  return fallback;
}

export function resolveIdCadIntTran(
  fiscal: Record<string, unknown> | undefined,
  fallback: string,
): string {
  const intermed = fiscal?.infIntermed as Record<string, unknown> | undefined;
  const id = intermed?.idCadIntTran;
  return typeof id === "string" && id.trim() ? id.trim() : fallback;
}

export function nfeAutXmlBlocks(cpfs: readonly string[]): string {
  return cpfs
    .map((cpf) => `      <autXML>\n        <CPF>${cpf.replace(/\D/g, "")}</CPF>\n      </autXML>`)
    .join("\n");
}

/** Complemento do destinatário — ML envia placeholder quando vazio. */
export function destComplementoXml(complemento?: string, placeholder = "Nao consta"): string {
  const value = complemento?.trim() ? complemento : placeholder;
  return `\n          <xCpl>${xmlEscape(value)}</xCpl>`;
}

export function remessaInfCplText(destIe?: string): string {
  const ie = (destIe ?? "").replace(/\D/g, "");
  const base = "Remessa para Deposito Temporario - Portaria CAT 31/2019.";
  if (!ie) return base;
  return `${base} Inscricao Estadual do Operador Logistico: ${ie}`;
}
