import { roundMoney } from "@msimulation-xml/fiscal-core";
/**
 * Blocos XML NF-e v4.00 reutilizáveis entre remessa, venda e demais tipos.
 * Centraliza formatação alinhada aos XMLs reais do Mercado Livre.
 */

import {
  estimateRemessaPesoVol,
  mercadoLivre,
  type NfeTransporta,
} from "@msimulation-xml/fiscal-core";
import type { IcmsTotInput } from "../fiscal-engine-xml.js";

export type IcmsTotValues = IcmsTotInput;

export type NfeTransportaInput = NfeTransporta;

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
  cst: mercadoLivre.ML_IBS_CBS_REMESSA.st,
  cClassTrib: mercadoLivre.ML_IBS_CBS_REMESSA.cClassTrib,
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

export function impostoIpiIntXml(cst = "55", cEnq = "103"): string {
  return `<IPI>
            <cEnq>${cEnq}</cEnq>
            <IPINT><CST>${cst}</CST></IPINT>
          </IPI>`;
}

/** Arredondamento comercial em 2 casas (`fiscal-core`, meio-para-cima decimal). */
export { roundMoney };

/** Entradas para cálculo da BC do IBS/CBS por item (NT 2025.002, regra UB16-10). */
export type IbsCbsVBcInput = {
  vProd: number;
  vServ?: number;
  vFrete?: number;
  vSeg?: number;
  vOutro?: number;
  vII?: number;
  vDesc?: number;
  vPIS?: number;
  vCOFINS?: number;
  vICMS?: number;
  vICMSUFDest?: number;
  vFCP?: number;
  vFCPUFDest?: number;
  vICMSMono?: number;
  vISSQN?: number;
  vIS?: number;
};

/**
 * CST com ind_gIBSCBS = 0 (isenção, suspensão, imunidade etc.) não deve informar gIBSCBS.
 * Faixa 400–619 conforme tabela de indicadores da NT 2025.002.
 */
export function cstRequiresGIbscbs(cst: string): boolean {
  const code = Number(cst.slice(0, 3));
  if (!Number.isFinite(code)) return true;
  return code < 400 || code >= 620;
}

function resolveEmitGIbscbs(
  ibsCbs: Record<string, unknown> | null | undefined,
  cst: string,
): boolean {
  const flag = ibsCbs?.emitGIBSCBS ?? ibsCbs?.indGIbscbs;
  if (flag === true || flag === 1 || flag === "1") return true;
  if (flag === false || flag === 0 || flag === "0") return false;
  return cstRequiresGIbscbs(cst);
}

/** BC do item: vProd (+ encargos) − tributos que compõem a base (UB16-10). */
export function calcIbsCbsItemVBc(input: IbsCbsVBcInput): number {
  return Math.max(
    0,
    roundMoney(
      (input.vProd ?? 0) +
        (input.vServ ?? 0) +
        (input.vFrete ?? 0) +
        (input.vSeg ?? 0) +
        (input.vOutro ?? 0) +
        (input.vII ?? 0) -
        (input.vDesc ?? 0) -
        (input.vPIS ?? 0) -
        (input.vCOFINS ?? 0) -
        (input.vICMS ?? 0) -
        (input.vICMSUFDest ?? 0) -
        (input.vFCP ?? 0) -
        (input.vFCPUFDest ?? 0) -
        (input.vICMSMono ?? 0) -
        (input.vISSQN ?? 0) +
        (input.vIS ?? 0),
    ),
  );
}

/** Soma das BC já arredondadas por item — evita rejeição 1076. */
export function sumIbsCbsVBc(values: readonly number[]): number {
  return values.reduce((acc, v) => roundMoney(acc + v), 0);
}

/** Resolve vBC do item: explícito no payload ou fórmula UB16-10; null se CST não exige gIBSCBS. */
export function resolveIbsCbsItemVBc(
  ibsCbs: Record<string, unknown> | null | undefined,
  bcInput: IbsCbsVBcInput,
  defaults: IbsCbsDefaults,
): number | null {
  const cst = String(ibsCbs?.st ?? ibsCbs?.cst ?? defaults.cst).slice(0, 3);
  if (!resolveEmitGIbscbs(ibsCbs, cst)) return null;
  const explicit = ibsCbs?.vBC ?? ibsCbs?.vBc;
  if (explicit != null) return roundMoney(asNum(explicit, 0));
  return calcIbsCbsItemVBc(bcInput);
}

function ibsCbsImpostoXml(
  ibsCbs: Record<string, unknown> | null | undefined,
  defaults: IbsCbsDefaults,
  alwaysEmit: boolean,
  vBC?: number | null,
): string {
  const hasExplicit =
    !!ibsCbs && (ibsCbs.st != null || ibsCbs.cst != null || ibsCbs.cClassTrib != null);
  if (!alwaysEmit && !hasExplicit) return "";
  const cst = String(ibsCbs?.st ?? ibsCbs?.cst ?? defaults.cst).slice(0, 3);
  const cClassTrib = String(ibsCbs?.cClassTrib ?? defaults.cClassTrib).slice(0, 6);
  const gIbscbsXml =
    vBC != null && Number.isFinite(vBC) ? `<gIBSCBS><vBC>${vBC.toFixed(2)}</vBC></gIBSCBS>` : "";
  return `<IBSCBS><CST>${cst}</CST><cClassTrib>${cClassTrib}</cClassTrib>${gIbscbsXml}</IBSCBS>`;
}

export type IbsCbsVendaRates = {
  pIBSUF: number;
  pIBSMun: number;
  pCBS: number;
};

export function calcIbsCbsVendaValues(vBC: number, rates: IbsCbsVendaRates) {
  const vIBSUF = roundMoney(vBC * (rates.pIBSUF / 100));
  const vIBSMun = roundMoney(vBC * (rates.pIBSMun / 100));
  const vIBS = roundMoney(vIBSUF + vIBSMun);
  const vCBS = roundMoney(vBC * (rates.pCBS / 100));
  return { vIBSUF, vIBSMun, vIBS, vCBS };
}

function readVendaIbsCbsRates(ibsCbs?: Record<string, unknown> | null): IbsCbsVendaRates {
  return {
    pIBSUF: asNum(ibsCbs?.pIBSUF, 0.1),
    pIBSMun: asNum(ibsCbs?.pIBSMun, 0),
    pCBS: asNum(ibsCbs?.pCBS, 0.9),
  };
}

/** Venda ML: `<IBSCBS>` com `<gIBSUF>`, `<gIBSMun>` e `<gCBS>`. */
export function ibsCbsImpostoXmlVenda(
  ibsCbs?: Record<string, unknown> | null,
  vBC?: number | null,
): string {
  const hasExplicit =
    !!ibsCbs && (ibsCbs.st != null || ibsCbs.cst != null || ibsCbs.cClassTrib != null);
  if (!hasExplicit || vBC == null || !Number.isFinite(vBC)) return "";
  const cst = String(ibsCbs?.st ?? ibsCbs?.cst ?? VENDA_IBS_CBS_DEFAULTS.cst).slice(0, 3);
  const cClassTrib = String(ibsCbs?.cClassTrib ?? VENDA_IBS_CBS_DEFAULTS.cClassTrib).slice(0, 6);
  const rates = readVendaIbsCbsRates(ibsCbs);
  const { vIBSUF, vIBSMun, vIBS, vCBS } = calcIbsCbsVendaValues(vBC, rates);
  return `<IBSCBS><CST>${cst}</CST><cClassTrib>${cClassTrib}</cClassTrib><gIBSCBS><vBC>${vBC.toFixed(2)}</vBC><gIBSUF><pIBSUF>${rates.pIBSUF.toFixed(2)}</pIBSUF><vIBSUF>${vIBSUF.toFixed(2)}</vIBSUF></gIBSUF><gIBSMun><pIBSMun>${rates.pIBSMun.toFixed(2)}</pIBSMun><vIBSMun>${vIBSMun.toFixed(2)}</vIBSMun></gIBSMun><vIBS>${vIBS.toFixed(2)}</vIBS><gCBS><pCBS>${rates.pCBS.toFixed(2)}</pCBS><vCBS>${vCBS.toFixed(2)}</vCBS></gCBS></gIBSCBS></IBSCBS>`;
}

export function ibsCbsTotXmlVenda(vBC: number, ibsCbs?: Record<string, unknown> | null): string {
  const rates = readVendaIbsCbsRates(ibsCbs);
  const { vIBSUF, vIBSMun, vIBS, vCBS } = calcIbsCbsVendaValues(vBC, rates);
  return `<IBSCBSTot>
          <vBCIBSCBS>${vBC.toFixed(2)}</vBCIBSCBS>
          <gIBS><gIBSUF><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSUF>${vIBSUF.toFixed(2)}</vIBSUF></gIBSUF><gIBSMun><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vIBSMun>${vIBSMun.toFixed(2)}</vIBSMun></gIBSMun><vIBS>${vIBS.toFixed(2)}</vIBS><vCredPres>0.00</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gIBS><gCBS><vDif>0.00</vDif><vDevTrib>0.00</vDevTrib><vCBS>${vCBS.toFixed(2)}</vCBS><vCredPres>0.00</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gCBS></IBSCBSTot>`;
}

/** Remessa: sempre emite IBSCBS; sem `ibsCbs` no payload vale o padrão do ML (o perfil já preenche). */
export function ibsCbsImpostoXmlRemessa(
  ibsCbs?: Record<string, unknown> | null,
  vBC?: number | null,
): string {
  return ibsCbsImpostoXml(ibsCbs, REMESSA_IBS_CBS_DEFAULTS, true, vBC);
}

export function ibsCbsTotXml(vBCIBSCBS = 0): string {
  return `<IBSCBSTot>
          <vBCIBSCBS>${vBCIBSCBS.toFixed(2)}</vBCIBSCBS>
        </IBSCBSTot>`;
}

export function vNFTotXml(vNF: number): string {
  return `<vNFTot>${vNF.toFixed(2)}</vNFTot>`;
}

export function transportaXml(t: NfeTransportaInput): string {
  const lines = ["        <transporta>"];
  if (t.cnpj?.trim()) {
    lines.push(`          <CNPJ>${t.cnpj.replace(/\D/g, "")}</CNPJ>`);
  }
  if (t.xNome?.trim()) {
    lines.push(`          <xNome>${xmlEscape(t.xNome)}</xNome>`);
  }
  if (t.ie?.trim()) {
    lines.push(`          <IE>${t.ie.replace(/\D/g, "")}</IE>`);
  }
  if (t.xEnder?.trim()) {
    lines.push(`          <xEnder>${xmlEscape(t.xEnder)}</xEnder>`);
  }
  if (t.xMun?.trim()) {
    lines.push(`          <xMun>${xmlEscape(t.xMun)}</xMun>`);
  }
  if (t.uf?.trim()) {
    lines.push(`          <UF>${t.uf}</UF>`);
  }
  lines.push("        </transporta>");
  return lines.join("\n");
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
    ...(fallback.cnpj || raw.cnpj ? { cnpj: String(raw.cnpj ?? fallback.cnpj ?? "") } : {}),
    xNome: String(raw.xNome ?? fallback.xNome),
    ...(fallback.ie || raw.ie ? { ie: String(raw.ie ?? fallback.ie ?? "") } : {}),
    ...(fallback.xEnder || raw.xEnder
      ? { xEnder: String(raw.xEnder ?? fallback.xEnder ?? "") }
      : {}),
    ...(fallback.xMun || raw.xMun ? { xMun: String(raw.xMun ?? fallback.xMun ?? "") } : {}),
    ...(fallback.uf || raw.uf ? { uf: String(raw.uf ?? fallback.uf ?? "") } : {}),
  };
}

export function resolveAutXmlCpfs(
  fiscal: Record<string, unknown> | undefined,
  fallback: readonly string[],
): readonly string[] {
  const fromPayload = fiscal?.autXmlCpfs;
  if (
    Array.isArray(fromPayload) &&
    fromPayload.length > 0 &&
    fromPayload.every((c) => typeof c === "string")
  ) {
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
