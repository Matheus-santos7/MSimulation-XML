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
import type { IcmsTotInput } from "../fiscal-engine-xml.js";

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

/** @deprecated Use `buildIpiXmlFromEngine` / snapshot da regra — mantido só para compat. */
export function impostoIpiRemessaXml(): string {
  return impostoIpiIntXml();
}

export function impostoIpiIntXml(cst = "55", cEnq = "103"): string {
  return `<IPI>
            <cEnq>${cEnq}</cEnq>
            <IPINT><CST>${cst}</CST></IPINT>
          </IPI>`;
}

/** Arredondamento comercial em 2 casas — alinhado ao tax-engine do backend. */
export function roundMoney(value: number): number {
  return Number((value + Number.EPSILON).toFixed(2));
}

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

function resolveEmitGIbscbs(ibsCbs: Record<string, unknown> | null | undefined, cst: string): boolean {
  const flag = ibsCbs?.emitGIBSCBS ?? ibsCbs?.indGIbscbs;
  if (flag === true || flag === 1 || flag === "1") return true;
  if (flag === false || flag === 0 || flag === "0") return false;
  return cstRequiresGIbscbs(cst);
}

/** BC do item: vProd (+ encargos) − tributos que compõem a base (UB16-10). */
export function calcIbsCbsItemVBc(input: IbsCbsVBcInput): number {
  return Math.max(0, roundMoney(
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
  ));
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
    vBC != null && Number.isFinite(vBC)
      ? `<gIBSCBS><vBC>${vBC.toFixed(2)}</vBC></gIBSCBS>`
      : "";
  return `<IBSCBS><CST>${cst}</CST><cClassTrib>${cClassTrib}</cClassTrib>${gIbscbsXml}</IBSCBS>`;
}

/** Venda: emite IBSCBS apenas quando o payload traz dados. */
export function ibsCbsImpostoXmlFromPayload(
  ibsCbs?: Record<string, unknown> | null,
  vBC?: number | null,
): string {
  return ibsCbsImpostoXml(ibsCbs, VENDA_IBS_CBS_DEFAULTS, false, vBC);
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

export function nfePagXmlVenda(vNF: number, pagamento?: Record<string, unknown> | null): string {
  const card = (pagamento?.card as Record<string, unknown> | undefined) ?? {};
  const tPag = String(pagamento?.tPag ?? "03");
  const cAut = String(card.cAut ?? "837812");
  const tBand = String(card.tBand ?? "01");
  const tpIntegra = String(card.tpIntegra ?? "1");
  const cnpj = String(card.cnpj ?? "03007331000141").replace(/\D/g, "");
  return `      <pag>
        <detPag>
          <indPag>0</indPag>
          <tPag>${tPag}</tPag>
          <vPag>${vNF.toFixed(2)}</vPag>
          <card>
            <tpIntegra>${tpIntegra}</tpIntegra>
            <CNPJ>${cnpj}</CNPJ>
            <tBand>${tBand}</tBand>
            <cAut>${xmlEscape(cAut)}</cAut>
          </card>
        </detPag>
      </pag>`;
}

/** Remessa: sempre emite IBSCBS (padrão ML reforma tributária). */
export function ibsCbsImpostoXmlRemessa(
  ibsCbs?: Record<string, unknown> | null,
  vBC?: number | null,
): string {
  return ibsCbsImpostoXml(ibsCbs, REMESSA_IBS_CBS_DEFAULTS, true, vBC);
}

export function vItemXml(vItem: number): string {
  return `\n        <vItem>${vItem.toFixed(2)}</vItem>`;
}

export function icmsTotXml(t: IcmsTotValues, opts?: { includeDifalFields?: boolean }): string {
  void opts;
  const hasDifalValues =
    (t.vFCPUFDest ?? 0) !== 0 || (t.vICMSUFDest ?? 0) !== 0 || (t.vICMSUFRemet ?? 0) !== 0;
  const difal = hasDifalValues
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
          <vTotTrib>${(t.vTotTrib ?? 0).toFixed(2)}</vTotTrib>
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
  opts?: { includeReformaTributaria?: boolean; vBCIBSCBS?: number; ibsCbs?: Record<string, unknown> | null },
): string {
  const reforma =
    opts?.includeReformaTributaria !== false && opts?.vBCIBSCBS != null && opts?.ibsCbs
      ? `\n        ${ibsCbsTotXmlVenda(opts.vBCIBSCBS, opts.ibsCbs)}\n        ${vNFTotXml(vNF)}`
      : opts?.includeReformaTributaria !== false
        ? `\n        ${ibsCbsTotXml(opts?.vBCIBSCBS ?? 0)}\n        ${vNFTotXml(vNF)}`
        : "";
  return `${icmsTot}${reforma}`;
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

export function nfeTranspXml(opts: {
  modFrete: string;
  transporta?: NfeTransportaInput | null;
  vol: NfeTranspVolInput;
}): string {
  const transportaBlock = opts.transporta ? `\n${transportaXml(opts.transporta)}` : "";
  const volBlock =
    opts.modFrete === "9"
      ? ""
      : (() => {
          const qVol = opts.vol.qVol ?? 1;
          return `
        <vol>
          <qVol>${qVol}</qVol>
          <pesoL>${opts.vol.pesoL.toFixed(3)}</pesoL>
          <pesoB>${opts.vol.pesoB.toFixed(3)}</pesoB>
        </vol>`;
        })();
  return `      <transp>
        <modFrete>${opts.modFrete}</modFrete>${transportaBlock}${volBlock}
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
    ...(fallback.cnpj || raw.cnpj ? { cnpj: String(raw.cnpj ?? fallback.cnpj ?? "") } : {}),
    xNome: String(raw.xNome ?? fallback.xNome),
    ...(fallback.ie || raw.ie ? { ie: String(raw.ie ?? fallback.ie ?? "") } : {}),
    ...(fallback.xEnder || raw.xEnder ? { xEnder: String(raw.xEnder ?? fallback.xEnder ?? "") } : {}),
    ...(fallback.xMun || raw.xMun ? { xMun: String(raw.xMun ?? fallback.xMun ?? "") } : {}),
    ...(fallback.uf || raw.uf ? { uf: String(raw.uf ?? fallback.uf ?? "") } : {}),
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

/** Informações complementares da remessa inbound (Portaria CAT 31/2019). */
export function remessaInfCplText(destIe?: string): string {
  return `Remessa para Deposito Temporario - Portaria CAT 31/2019. Inscricao Estadual do Operador Logistico: ${destIe?.trim() ?? ""}`;
}

export type RemessaSimbolicaPosDevolucaoInfCplInput = {
  destIe?: string;
  devolucaoNumero: number;
  devolucaoSerie: number;
  devolucaoEmitidaEm: Date | string;
};

function formatNfeDateBr(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Informações complementares da remessa simbólica após devolução de venda. */
export function remessaSimbolicaPosDevolucaoInfCplText(
  input: RemessaSimbolicaPosDevolucaoInfCplInput,
): string {
  const ie = input.destIe?.replace(/\D/g, "").trim() ?? "";
  const data = formatNfeDateBr(input.devolucaoEmitidaEm);
  return (
    `Remessa Simbolica para Deposito Temporario - Portaria CAT 31/2019. ` +
    `Inscricao Estadual do Operador Logistico: ${ie}. ` +
    `Nota fiscal de devolucao n ${input.devolucaoNumero} emitida em ${data} serie ${input.devolucaoSerie}.`
  );
}

export function retornoInfCplText(): string {
  return "Retorno Simbolico de Deposito Temporario.";
}

export function infRespTecXml(opts: {
  cnpj: string;
  xContato: string;
  email: string;
  fone: string;
  idCSRT?: string;
  hashCSRT?: string;
}): string {
  const csrtBlock =
    opts.idCSRT?.trim() && opts.hashCSRT?.trim()
      ? `\n        <idCSRT>${xmlEscape(opts.idCSRT)}</idCSRT>\n        <hashCSRT>${xmlEscape(opts.hashCSRT)}</hashCSRT>`
      : "";
  return `      <infRespTec>
        <CNPJ>${opts.cnpj.replace(/\D/g, "")}</CNPJ>
        <xContato>${xmlEscape(opts.xContato)}</xContato>
        <email>${xmlEscape(opts.email)}</email>
        <fone>${opts.fone.replace(/\D/g, "")}</fone>${csrtBlock}
      </infRespTec>`;
}
