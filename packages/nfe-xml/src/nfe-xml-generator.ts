/**
 * NFe v4.00 XML generator — SIMULATION ONLY.
 *
 * Contrato (fase 3):
 * - Tributos e `<ICMSTot>`: `fiscalPayload.engine` do backend quando existir.
 * - `refNFe`, `obsCont/xTexto`: DTO + fiscal-core (`xTextoFromNfe`).
 * - Assinatura, `protNFe`, envelope: simulação local (não SEFAZ).
 *
 * @see fiscal-engine-xml.ts — leitura de `engine`
 */

import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";
import { ML_INF_RESP_TEC } from "@msimulation-xml/fiscal-core";
import {
  ensureNProt,
  injectSimulationSignature,
  NFE_SIGNATURE_CONFIG,
  EVENTO_SIGNATURE_CONFIG,
  simulationNProt,
  simulationProtDigVal,
  formatNfeDateTime,
  lineTotal,
  productUnitPriceForNfe,
  xTextoFromNfe,
} from "@msimulation-xml/fiscal-core";
import {
  REMESSA_AUT_XML_CPFS,
  REMESSA_ML_INTERMED_CNPJ,
  REMESSA_ML_INTERMED_ID,
  REMESSA_ML_TRANSPORTA,
  ufToCodigo,
} from "./constants.js";
import {
  destComplementoXml,
  formatNfeQuantity,
  resolveAutXmlCpfs,
  resolveIdCadIntTran,
  resolveRemessaTranspVol,
  ibsCbsImpostoXmlFromPayload,
  ibsCbsImpostoXmlRemessa,
  type IbsCbsVBcInput,
  icmsTotXml,
  REMESSA_IBS_CBS_DEFAULTS,
  resolveIbsCbsItemVBc,
  sumIbsCbsVBc,
  VENDA_IBS_CBS_DEFAULTS,
  impostoIpiIntXml,
  nfeAutXmlBlocks,
  nfeTotalXml,
  nfeTranspXml,
  remessaInfCplText,
  retornoInfCplText,
  infRespTecXml,
  resolveTransportaFromFiscal,
  vItemXml,
} from "./nfe-xml-blocks.js";
import {
  buildIcmsXmlFromEngineItem,
  buildIpiXmlFromEngine,
  buildIpiXmlFromFiscalSnapshot,
  buildPisCofinsXmlFromEngine,
  fiscalCodeText,
  icmsTotFromEngine,
  parseEngineFromFiscalPayload,
  type EngineItem,
} from "./fiscal-engine-xml.js";
import { resolveEmitterFromPayload } from "./resolve-emitter.js";
import type {
  EmitenteXml,
  FiscalEventoXmlInput,
  NFeXmlInput,
  ProductXmlInput,
} from "./types.js";

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** IE do destinatário — vem do CD (`fiscalPayload.destIe`), não de constante fixa. */
function destIeXmlFromPayload(
  indIEDest: number,
  fiscal: Record<string, unknown>,
  ie?: string,
): string {
  if (indIEDest !== 1) return "";
  const raw =
    (typeof fiscal.destIe === "string" && fiscal.destIe) ||
    (typeof ie === "string" && ie) ||
    "";
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  return `\n        <IE>${digits}</IE>`;
}

function formatEanForXml(ean?: string): string {
  const digits = (ean ?? "").replace(/\D/g, "");
  if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
    return digits;
  }
  return "SEM GTIN";
}

function asNum(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function startsWithTaxCode(v: unknown, prefix: string): boolean {
  return typeof v === "string" && v.trim().startsWith(prefix);
}

function buildIcmsXmlFromSnapshot(
  icms: Record<string, unknown>,
  args: { orig: number; valor: number; valorIcms: number },
): string {
  const cst = String(icms.cst ?? "00").slice(0, 2);
  const pIcms = asNum(icms.aliquota, 0);
  const pRedBc = asNum(icms.pRedBc, 0);
  const pRedBcSt = asNum(icms.pRedBcSt, 0);
  const pMva = asNum(icms.pMva, 0);
  const pIcmsStRet = asNum(icms.pIcmsStRet, 0);
  const pFcpStRet = asNum(icms.pFcpStRet, 0);
  const pIcmsEfet = asNum(icms.pIcmsEfet, 0);
  const pRedBcEfet = asNum(icms.pRedBcEfet, 0);
  const motDesIcms = Math.trunc(asNum(icms.motDesIcms, 0));

  const vBcFromSnapshot = icms.vBc != null ? asNum(icms.vBc, args.valor) : null;
  const vBc =
    vBcFromSnapshot ?? (pIcms === 0 ? 0 : Math.max(0, args.valor * (1 - pRedBc / 100)));
  const vIcms =
    asNum(icms.valorIcms, 0) || args.valorIcms || Math.round(vBc * (pIcms / 100) * 100) / 100;
  const vBcSt = Math.max(0, vBc * (1 + pMva / 100) * (1 - pRedBcSt / 100));
  const vIcmsSt = Math.max(0, Math.round(vBcSt * (pIcmsStRet / 100) * 100) / 100);
  const vBcEfet = Math.max(0, args.valor * (1 - pRedBcEfet / 100));
  const vIcmsEfet = Math.max(0, Math.round(vBcEfet * (pIcmsEfet / 100) * 100) / 100);
  const vFcpSt = Math.max(0, Math.round(vBcSt * (pFcpStRet / 100) * 100) / 100);

  const cBenef = typeof icms.codBenef === "string" && icms.codBenef.trim() ? `<cBenef>${xmlEscape(String(icms.codBenef))}</cBenef>` : "";
  const motDes = motDesIcms > 0 ? `<motDesICMS>${motDesIcms}</motDesICMS>` : "";

  switch (cst) {
    case "10":
      return `<ICMS><ICMS10><orig>${args.orig}</orig><CST>10</CST><modBC>3</modBC><vBC>${vBc.toFixed(2)}</vBC><pICMS>${pIcms.toFixed(4)}</pICMS><vICMS>${vIcms.toFixed(2)}</vICMS><modBCST>4</modBCST><pMVAST>${pMva.toFixed(4)}</pMVAST><pRedBCST>${pRedBcSt.toFixed(4)}</pRedBCST><vBCST>${vBcSt.toFixed(2)}</vBCST><pICMSST>${pIcmsStRet.toFixed(4)}</pICMSST><vICMSST>${vIcmsSt.toFixed(2)}</vICMSST></ICMS10></ICMS>`;
    case "20":
      return `<ICMS><ICMS20><orig>${args.orig}</orig><CST>20</CST><modBC>3</modBC><pRedBC>${pRedBc.toFixed(4)}</pRedBC><vBC>${vBc.toFixed(2)}</vBC><pICMS>${pIcms.toFixed(4)}</pICMS><vICMS>${vIcms.toFixed(2)}</vICMS>${motDes}${cBenef}</ICMS20></ICMS>`;
    case "30":
      return `<ICMS><ICMS30><orig>${args.orig}</orig><CST>30</CST><modBCST>4</modBCST><pMVAST>${pMva.toFixed(4)}</pMVAST><pRedBCST>${pRedBcSt.toFixed(4)}</pRedBCST><vBCST>${vBcSt.toFixed(2)}</vBCST><pICMSST>${pIcmsStRet.toFixed(4)}</pICMSST><vICMSST>${vIcmsSt.toFixed(2)}</vICMSST><vBCFCPST>${vBcSt.toFixed(2)}</vBCFCPST><pFCPST>${pFcpStRet.toFixed(4)}</pFCPST><vFCPST>${vFcpSt.toFixed(2)}</vFCPST>${motDes}${cBenef}</ICMS30></ICMS>`;
    case "40":
    case "50":
      return `<ICMS><ICMS40><orig>${args.orig}</orig><CST>${cst}</CST>${motDes}${cBenef}</ICMS40></ICMS>`;
    case "41":
      return `<ICMS><ICMS40><orig>${args.orig}</orig><CST>41</CST>${motDes}${cBenef}</ICMS40></ICMS>`;
    case "51":
      return `<ICMS><ICMS51><orig>${args.orig}</orig><CST>51</CST><modBC>3</modBC><pRedBC>${pRedBc.toFixed(4)}</pRedBC><pICMS>${pIcms.toFixed(4)}</pICMS></ICMS51></ICMS>`;
    case "60":
      return `<ICMS><ICMS60><orig>${args.orig}</orig><CST>60</CST><vBCSTRet>${vBcSt.toFixed(2)}</vBCSTRet><pST>${pIcmsStRet.toFixed(4)}</pST><vICMSSubstituto>${vIcmsSt.toFixed(2)}</vICMSSubstituto><vICMSSTRet>${vIcmsSt.toFixed(2)}</vICMSSTRet><vBCFCPSTRet>${vBcSt.toFixed(2)}</vBCFCPSTRet><pFCPSTRet>${pFcpStRet.toFixed(4)}</pFCPSTRet><vFCPSTRet>${vFcpSt.toFixed(2)}</vFCPSTRet></ICMS60></ICMS>`;
    case "70":
      return `<ICMS><ICMS70><orig>${args.orig}</orig><CST>70</CST><modBC>3</modBC><pRedBC>${pRedBc.toFixed(4)}</pRedBC><vBC>${vBc.toFixed(2)}</vBC><pICMS>${pIcms.toFixed(4)}</pICMS><vICMS>${vIcms.toFixed(2)}</vICMS><modBCST>4</modBCST><pMVAST>${pMva.toFixed(4)}</pMVAST><pRedBCST>${pRedBcSt.toFixed(4)}</pRedBCST><vBCST>${vBcSt.toFixed(2)}</vBCST><pICMSST>${pIcmsStRet.toFixed(4)}</pICMSST><vICMSST>${vIcmsSt.toFixed(2)}</vICMSST><vICMSDeson>${vIcmsEfet.toFixed(2)}</vICMSDeson>${motDes}${cBenef}</ICMS70></ICMS>`;
    case "90":
      return `<ICMS><ICMS90><orig>${args.orig}</orig><CST>90</CST><modBC>3</modBC><vBC>${vBc.toFixed(2)}</vBC><pRedBC>${pRedBc.toFixed(4)}</pRedBC><pICMS>${pIcms.toFixed(4)}</pICMS><vICMS>${vIcms.toFixed(2)}</vICMS><modBCST>4</modBCST><pMVAST>${pMva.toFixed(4)}</pMVAST><pRedBCST>${pRedBcSt.toFixed(4)}</pRedBCST><vBCST>${vBcSt.toFixed(2)}</vBCST><pICMSST>${pIcmsStRet.toFixed(4)}</pICMSST><vICMSST>${vIcmsSt.toFixed(2)}</vICMSST></ICMS90></ICMS>`;
    default:
      return `<ICMS><ICMS00><orig>${args.orig}</orig><CST>00</CST><modBC>3</modBC><vBC>${args.valor.toFixed(2)}</vBC><pICMS>${pIcms.toFixed(4)}</pICMS><vICMS>${args.valorIcms.toFixed(2)}</vICMS></ICMS00></ICMS>`;
  }
}

function protNFeBlock(nfe: NFeXmlInput, dhEmi: string): string {
  return `  <protNFe versao="4.00">
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>SIMULATION-3.2</verAplic>
      <chNFe>${nfe.chave}</chNFe>
      <dhRecbto>${dhEmi}</dhRecbto>
      <nProt>${simulationNProt(nfe.numero)}</nProt>
      <digVal>${simulationProtDigVal(nfe.chave)}</digVal>
      <cStat>${nfe.status === "AUTORIZADA" ? 100 : nfe.status === "REJEITADA" ? 539 : 103}</cStat>
      <xMotivo>${nfe.status === "AUTORIZADA" ? "Autorizado o uso da NF-e (SIMULAÇÃO)" : nfe.status}</xMotivo>
    </infProt>
  </protNFe>`;
}

function infAdicXml(
  nfe: NFeXmlInput,
  emitter: ReturnType<typeof resolveEmitterFromPayload>,
  extra?: string,
): string {
  const parts = [emitter.mensagemInfCpl, extra].filter((s) => s && s.trim());
  if (emitter.difal.aplica && emitter.difal.vDifal > 0) {
    parts.push(`DIFAL (${emitter.difal.mode}): R$ ${emitter.difal.vDifal.toFixed(2)}`);
  }
  const xTexto = xTextoFromNfe(nfe);
  if (parts.length === 0 && !xTexto) return "";

  const infCpl =
    parts.length > 0 ? `\n        <infCpl>${xmlEscape(parts.join(" | "))}</infCpl>` : "";
  const obsCont = xTexto
    ? `\n        <obsCont xCampo="external_id">\n          <xTexto>${xmlEscape(xTexto)}</xTexto>\n        </obsCont>`
    : "";

  return `\n      <infAdic>${infCpl}${obsCont}\n      </infAdic>`;
}

function transpXml(
  modFrete: string,
  fiscal: Record<string, unknown>,
  quantidade: number,
): string {
  const transporta =
    fiscal.transporta != null || modFrete === "2"
      ? resolveTransportaFromFiscal(fiscal, REMESSA_ML_TRANSPORTA)
      : null;
  return nfeTranspXml({
    modFrete,
    transporta,
    vol: resolveRemessaTranspVol(quantidade, fiscal),
  });
}

function nfciXmlFromSources(fiscal: Record<string, unknown>, prod?: ProductXmlInput): string {
  const nfciRaw =
    (typeof fiscal.nfci === "string" && fiscal.nfci) ||
    (typeof prod?.nfci === "string" && prod.nfci) ||
    "";
  return nfciRaw ? `\n          <nFCI>${xmlEscape(nfciRaw)}</nFCI>` : "";
}

/**
 * Bloco NFref dentro de ide (após verProc), conforme XMLs reais em XMLs/.
 * Usa apenas `nfeReferenciaChave` (nota que ESTA nota referencia).
 * Não usar `referencias` do DTO — esse campo lista notas filhas (nfeReferenciadas).
 */
function ideNfRefXml(nfe: NFeXmlInput): string {
  // Remessa física (entrada de produto/quantidade no full) é sempre a primeira — sem refNFe.
  if (nfe.tipo === "REMESSA") return "";

  if (!nfe.nfeReferenciaChave) return "";
  const k = nfe.nfeReferenciaChave.replace(/\D/g, "");
  if (k.length !== 44) return "";

  return `\n        <NFref>\n          <refNFe>${k}</refNFe>\n        </NFref>`;
}

function idDestFromUfs(emitUf: string, destUf: string): number {
  return emitUf.toUpperCase() === destUf.toUpperCase() ? 1 : 2;
}

function pagBlock(): string {
  return `      <pag>
        <detPag>
          <indPag>0</indPag>
          <tPag>90</tPag>
          <vPag>0.00</vPag>
        </detPag>
      </pag>`;
}

function infIntermedBlock(fiscal?: Record<string, unknown>): string {
  const idCadIntTran = resolveIdCadIntTran(fiscal, REMESSA_ML_INTERMED_ID);
  return `      <infIntermed>
        <CNPJ>${REMESSA_ML_INTERMED_CNPJ}</CNPJ>
        <idCadIntTran>${idCadIntTran}</idCadIntTran>
      </infIntermed>`;
}

function autXmlBlock(fiscal?: Record<string, unknown>): string {
  const cpfs = resolveAutXmlCpfs(fiscal, REMESSA_AUT_XML_CPFS);
  const blocks = nfeAutXmlBlocks(cpfs);
  return blocks ? `${blocks}\n` : "";
}

function hasMlFulfillmentPayload(fiscal: Record<string, unknown>): boolean {
  return fiscal.ibsCbs != null || fiscal.autXmlCpfs != null || fiscal.infIntermed != null;
}

function ibsCbsBcInputFromEngineItem(engineItem?: EngineItem): IbsCbsVBcInput {
  return {
    vProd: engineItem?.vProd ?? 0,
    vPIS: engineItem?.pis.vPIS ?? 0,
    vCOFINS: engineItem?.cofins.vCOFINS ?? 0,
    vICMS: engineItem?.icms.vICMS ?? 0,
    vFCP: engineItem?.icms.vFCP ?? 0,
    vICMSUFDest: engineItem?.difal?.vICMSUFDest ?? 0,
    vFCPUFDest: engineItem?.difal?.vFCPUFDest ?? 0,
  };
}

function ibsCbsBcInputFromSnapshot(
  vProd: number,
  fiscal: Record<string, unknown>,
  valorIcms: number,
): IbsCbsVBcInput {
  const pis = (fiscal.pis as Record<string, unknown> | undefined) ?? {};
  const cofins = (fiscal.cofins as Record<string, unknown> | undefined) ?? {};
  const vBcPis = asNum(pis.vBc, vProd);
  const pPis = asNum(pis.aliquota, 0);
  const pCofins = asNum(cofins.aliquota, 0);
  const difal = (fiscal.difal as Record<string, unknown> | undefined) ?? {};
  return {
    vProd,
    vPIS: Math.round(vBcPis * (pPis / 100) * 100) / 100,
    vCOFINS: Math.round(vBcPis * (pCofins / 100) * 100) / 100,
    vICMS: valorIcms,
    vICMSUFDest: asNum(difal.vICMSUFDest, 0),
    vFCPUFDest: asNum(difal.vFCPUFDest, 0),
  };
}

function fulfillmentImpostoExtras(
  fiscal: Record<string, unknown>,
  vBC: number | null,
): string {
  if (!fiscal.ibsCbs) return "";
  return `\n          ${ibsCbsImpostoXmlRemessa(fiscal.ibsCbs as Record<string, unknown>, vBC)}`;
}

function fulfillmentDetTail(fiscal: Record<string, unknown>, vProd: number): string {
  if (!hasMlFulfillmentPayload(fiscal)) return "";
  return `${vItemXml(vProd)}`;
}

function icmsTotBlock(
  t: Parameters<typeof icmsTotXml>[0],
  includeDifalFields = false,
): string {
  return icmsTotXml(t, { includeDifalFields });
}

function totalBlock(
  icmsTot: string,
  vNF: number,
  opts?: { includeReformaTributaria?: boolean; vBCIBSCBS?: number },
): string {
  return nfeTotalXml(icmsTot, vNF, opts);
}

function pisCofinsXmlFromSnapshot(
  fiscal: Record<string, unknown>,
  emitter: ReturnType<typeof resolveEmitterFromPayload>,
): string {
  const pis = (fiscal.pis as Record<string, unknown> | undefined) ?? {};
  const cofins = (fiscal.cofins as Record<string, unknown> | undefined) ?? {};
  const vBc = asNum(pis.vBc, emitter.bases.vBcPisCofins);
  const pPis = asNum(pis.aliquota, 0);
  const pCofins = asNum(cofins.aliquota, 0);
  const vPis = Math.round(vBc * (pPis / 100) * 100) / 100;
  const vCofins = Math.round(vBc * (pCofins / 100) * 100) / 100;
  const cstPis = typeof pis.st === "string" ? pis.st.slice(0, 2) : "09";
  const cstCofins = typeof cofins.st === "string" ? cofins.st.slice(0, 2) : "09";
  return buildPisCofinsXmlFromEngine(
    { cst: cstPis, vBC: vBc, pPIS: pPis, vPIS: vPis, vCOFINS: 0, aliquota: pPis },
    { cst: cstCofins, vBC: vBc, pCOFINS: pCofins, vPIS: 0, vCOFINS: vCofins, aliquota: pCofins },
  );
}

/**
 * ICMS/IPI/PIS/COFINS do item: prioriza `engine` (tax-engine + planilha);
 * fallback no snapshot fiscal (`fiscalPayload.pis/ipi/cofins`).
 */
function buildItemImpostoXml(opts: {
  engineItem?: EngineItem;
  fiscal: Record<string, unknown>;
  emitter: ReturnType<typeof resolveEmitterFromPayload>;
  icmsSnapshotFallback: {
    orig: number;
    icms?: Record<string, unknown>;
    vBcIcms: number;
    valorIcms: number;
  };
}): { icmsXml: string; ipiXml: string; pisCofinsXml: string } {
  const { engineItem, fiscal, emitter, icmsSnapshotFallback } = opts;
  const { orig, icms, vBcIcms, valorIcms } = icmsSnapshotFallback;

  if (engineItem) {
    const icmsXml = buildIcmsXmlFromEngineItem(engineItem.icms);
    const pisCofinsXml = buildPisCofinsXmlFromEngine(engineItem.pis, engineItem.cofins);
    let ipiXml: string;
    if (engineItem.ipi) {
      ipiXml = buildIpiXmlFromEngine(engineItem.ipi);
    } else {
      const ipiSnap = (fiscal.ipi as Record<string, unknown> | undefined) ?? {};
      ipiXml =
        ipiSnap.st != null || ipiSnap.codEnq != null
          ? buildIpiXmlFromFiscalSnapshot(ipiSnap, emitter.bases.vBcIpi)
          : impostoIpiIntXml();
    }
    return { icmsXml, ipiXml, pisCofinsXml };
  }

  const icmsSnap = icms ?? { cst: "00", aliquota: 0 };
  const icmsXml = buildIcmsXmlFromSnapshot(icmsSnap, { orig, valor: vBcIcms, valorIcms });
  const pisCofinsXml = pisCofinsXmlFromSnapshot(fiscal, emitter);
  const ipiSnap = (fiscal.ipi as Record<string, unknown> | undefined) ?? {};
  const ipiXml =
    ipiSnap.st != null || ipiSnap.codEnq != null
      ? buildIpiXmlFromFiscalSnapshot(ipiSnap, emitter.bases.vBcIpi)
      : impostoIpiIntXml();
  return { icmsXml, ipiXml, pisCofinsXml };
}

export function buildNFeXML(
  nfe: NFeXmlInput,
  emit: EmitenteXml,
  product?: ProductXmlInput,
  emitterSettings?: FiscalEmitterSettingsData | null,
  products?: ProductXmlInput[],
): string {
  let xml: string;
  if (nfe.tipo === "REMESSA") {
    xml = buildRemessaNFeXML(nfe, emit, product, emitterSettings, products);
  } else if (nfe.tipo === "REMESSA_SIMBOLICA") {
    xml = buildRemessaSimbolicaNFeXML(nfe, emit, product, emitterSettings);
  } else if (nfe.tipo === "RETORNO_SIMBOLICO") {
    xml = buildRetornoNFeXML(nfe, emit, product, emitterSettings);
  } else if (nfe.tipo === "DEVOLUCAO") {
    xml = buildDevolucaoNFeXML(nfe, emit, product, emitterSettings);
  } else {
    xml = buildVendaNFeXML(nfe, emit, product, emitterSettings);
  }
  return injectSimulationSignature(xml, NFE_SIGNATURE_CONFIG);
}

/**
 * Layout XML NF-e v4.00 para remessa física (tpNF=1, idDest dinâmico, engine no payload).
 * Chamado por `buildNFeXML` quando `nfe.tipo === "REMESSA"`.
 * @see docs/remessa-fisica.md — Fase 8
 */
function buildRemessaNFeXML(
  nfe: NFeXmlInput,
  emit: EmitenteXml,
  product?: ProductXmlInput,
  emitterSettings?: FiscalEmitterSettingsData | null,
  products?: ProductXmlInput[],
): string {
  const id = "NFe" + nfe.chave;
  const dhEmi = formatNfeDateTime(nfe.emitidaEm);
  const e = emit.endereco;
  const xCplXml = e.xCpl ? `\n          <xCpl>${xmlEscape(e.xCpl)}</xCpl>` : "";
  const foneXml = e.fone ? `\n          <fone>${e.fone.replace(/\D/g, "")}</fone>` : "";
  const iestXml = emit.iest ? `\n        <IEST>${emit.iest.replace(/\D/g, "")}</IEST>` : "";

  const d = nfe.destinatario;
  const de = d.endereco;
  const docDigits = d.doc.replace(/\D/g, "");
  const destXCpl = destComplementoXml(de.complemento);
  const fiscal = (nfe.fiscalPayload ?? {}) as Record<string, unknown>;
  const destIeXml = destIeXmlFromPayload(d.indIEDest, fiscal, d.ie);
  const destIe =
    (typeof fiscal.destIe === "string" && fiscal.destIe) || (typeof d.ie === "string" && d.ie) || "";
  const cUF = ufToCodigo(e.uf);
  const idDest = idDestFromUfs(e.uf, de.uf);
  const engine = parseEngineFromFiscalPayload(fiscal);
  const icms = (fiscal.icms as Record<string, unknown> | undefined) ?? { cst: "00", aliquota: nfe.aliqICMS };
  const ibsCbs = (fiscal.ibsCbs as Record<string, unknown> | undefined) ?? {};
  const emitter = resolveEmitterFromPayload(fiscal, emitterSettings ?? null, nfe.tipo, nfe.valor, nfe.valorICMS);
  const vFrete = emitter.freteNoCalculo ? emitter.bases.vFrete : 0;
  const infAdic = infAdicXml(nfe, emitter, remessaInfCplText(destIe));
  const autXml = autXmlBlock(fiscal);
  const fulfillment = hasMlFulfillmentPayload(fiscal);
  const infRespTec = fulfillment
    ? `\n${infRespTecXml({
        cnpj: ML_INF_RESP_TEC.cnpj,
        xContato: ML_INF_RESP_TEC.xContato,
        email: ML_INF_RESP_TEC.email,
        fone: ML_INF_RESP_TEC.fone,
      })}`
    : "";

  const itemCount = Math.max(
    engine?.itens.length ?? 0,
    nfe.itens?.length ?? 0,
    products?.length ?? 0,
    1,
  );

  const totalQty =
    engine?.itens.reduce((s, it) => s + it.quantidade, 0) ??
    nfe.itens?.reduce((s, it) => s + it.quantidade, 0) ??
    nfe.quantidade;

  let icmsTot: string;
  let vNFTotal: number;
  if (engine?.itens.length) {
    icmsTot = icmsTotBlock(icmsTotFromEngine(engine.totais, vFrete), idDest === 2);
    vNFTotal = engine.totais.vNF;
  } else {
    const vBcIcms = asNum(icms.vBc, emitter.bases.vBcIcms);
    const valorIcms = asNum(icms.valorIcms, nfe.valorICMS);
    vNFTotal = nfe.valor;
    icmsTot = icmsTotBlock(
      {
        vBC: vBcIcms,
        vICMS: valorIcms,
        vProd: nfe.valor,
        vFrete,
        vIPI: 0,
        vPIS: 0,
        vCOFINS: 0,
        vNF: vNFTotal,
      },
      idDest === 2,
    );
  }
  const detBlocks: string[] = [];
  const ibsCbsVBcValues: number[] = [];
  for (let i = 0; i < itemCount; i++) {
    const dtoItem = nfe.itens?.[i];
    const prod = products?.[i] ?? dtoItem?.product ?? (i === 0 ? product : undefined);
    const engineItem = engine?.itens[i];
    const qCom = dtoItem?.quantidade ?? engineItem?.quantidade ?? (itemCount === 1 ? nfe.quantidade : 1);
    const cProd = prod?.sku ?? dtoItem?.product?.sku ?? `SKU-${nfe.numero}-${i + 1}`;
    const cEAN = formatEanForXml(prod?.ean ?? dtoItem?.product?.ean);
    const xProd = prod?.nome ?? dtoItem?.product?.nome ?? nfe.natOp;
    const ncm = dtoItem?.ncm ?? prod?.ncm ?? dtoItem?.product?.ncm ?? nfe.ncm;
    const cest = prod?.cest ?? dtoItem?.product?.cest;
    const exTipi = prod?.exTipi ?? dtoItem?.product?.exTipi;
    const cestXml = cest ? `\n          <CEST>${cest}</CEST>` : "";
    const exTipiXml = exTipi
      ? `\n          <EXTIPI>${exTipi}</EXTIPI>`
      : i === 0 && typeof fiscal.exTipi === "string" && fiscal.exTipi
        ? `\n          <EXTIPI>${fiscal.exTipi}</EXTIPI>`
        : "";
    const cfop = dtoItem?.cfop ?? nfe.cfop;
    const uCom = prod?.unidade ?? dtoItem?.product?.unidade ?? "UNID";
    const vUnComOut =
      engineItem?.valorUnitario ??
      (dtoItem?.valor != null && qCom ? dtoItem.valor / qCom : productUnitPriceForNfe(prod, nfe));
    const vProdOut = engineItem?.vProd ?? dtoItem?.valor ?? nfe.valor;
    const orig = prod?.origem ?? dtoItem?.product?.origem ?? 1;
    const infAdProd =
      i === 0 && nfe.pedidoML ? `\n        <infAdProd>xPed:${xmlEscape(nfe.pedidoML)}</infAdProd>` : "";
    const nfciXml = nfciXmlFromSources(fiscal, prod);
    const vItem = vItemXml(vProdOut);

    const vBcIcmsItem = asNum(icms.vBc, emitter.bases.vBcIcms);
    const valorIcmsItem = asNum(icms.valorIcms, nfe.valorICMS);
    const { icmsXml, ipiXml, pisCofinsXml } = buildItemImpostoXml({
      engineItem,
      fiscal,
      emitter,
      icmsSnapshotFallback: {
        orig,
        icms,
        vBcIcms: vBcIcmsItem,
        valorIcms: valorIcmsItem,
      },
    });

    const ibsCbsBcInput = engineItem
      ? ibsCbsBcInputFromEngineItem(engineItem)
      : ibsCbsBcInputFromSnapshot(
          vProdOut,
          fiscal,
          asNum(icms.valorIcms, nfe.valorICMS),
        );
    const itemVBcIbsCbs = resolveIbsCbsItemVBc(ibsCbs, ibsCbsBcInput, REMESSA_IBS_CBS_DEFAULTS);
    if (itemVBcIbsCbs != null) ibsCbsVBcValues.push(itemVBcIbsCbs);

    detBlocks.push(`      <det nItem="${i + 1}">
        <prod>
          <cProd>${xmlEscape(cProd)}</cProd>
          <cEAN>${cEAN}</cEAN>
          <xProd>${xmlEscape(xProd)}</xProd>
          <NCM>${ncm}</NCM>${cestXml}${exTipiXml}
          <CFOP>${cfop}</CFOP>
          <uCom>${xmlEscape(uCom)}</uCom>
          <qCom>${formatNfeQuantity(qCom)}</qCom>
          <vUnCom>${vUnComOut.toFixed(8)}</vUnCom>
          <vProd>${vProdOut.toFixed(2)}</vProd>
          <cEANTrib>${cEAN}</cEANTrib>
          <uTrib>${xmlEscape(uCom)}</uTrib>
          <qTrib>${formatNfeQuantity(qCom)}</qTrib>
          <vUnTrib>${vUnComOut.toFixed(8)}</vUnTrib>
          <indTot>1</indTot>${nfciXml}
        </prod>
        <imposto>
          <vTotTrib>0.00</vTotTrib>
          ${icmsXml}
          ${ipiXml}
          ${pisCofinsXml}
          ${ibsCbsImpostoXmlRemessa(ibsCbs, itemVBcIbsCbs)}
        </imposto>${infAdProd}${vItem}
      </det>`);
  }

  const totBlock = totalBlock(icmsTot, vNFTotal, {
    includeReformaTributaria: true,
    vBCIBSCBS: sumIbsCbsVBc(ibsCbsVBcValues),
  });

  const detXml = detBlocks.join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="${id}" versao="4.00">
      <ide>
        <cUF>${cUF}</cUF>
        <cNF>${nfe.chave.slice(35, 43)}</cNF>
        <natOp>${xmlEscape(nfe.natOp)}</natOp>
        <mod>55</mod>
        <serie>${nfe.serie}</serie>
        <nNF>${nfe.numero}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <dhSaiEnt>${dhEmi}</dhSaiEnt>
        <tpNF>1</tpNF>
        <idDest>${idDest}</idDest>
        <cMunFG>${e.cMun}</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${nfe.chave.slice(-1)}</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>0</indFinal>
        <indPres>2</indPres>
        <indIntermed>1</indIntermed>
        <procEmi>0</procEmi>
        <verProc>invoice-SIMULATION</verProc>${ideNfRefXml(nfe)}
      </ide>
      <emit>
        <CNPJ>${emit.cnpj.replace(/\D/g, "")}</CNPJ>
        <xNome>${xmlEscape(emit.xNome)}</xNome>
        <enderEmit>
          <xLgr>${xmlEscape(e.xLgr)}</xLgr>
          <nro>${xmlEscape(e.nro)}</nro>${xCplXml}
          <xBairro>${xmlEscape(e.xBairro)}</xBairro>
          <cMun>${e.cMun}</cMun>
          <xMun>${xmlEscape(e.xMun)}</xMun>
          <UF>${e.uf}</UF>
          <CEP>${e.cep.replace(/\D/g, "")}</CEP>
          <cPais>${e.cPais}</cPais>
          <xPais>${xmlEscape(e.xPais)}</xPais>${foneXml}
        </enderEmit>
        <IE>${emit.ie.replace(/\D/g, "")}</IE>${iestXml}
        <CRT>${emit.crt}</CRT>
      </emit>
      <dest>
        <CNPJ>${docDigits}</CNPJ>
        <xNome>${xmlEscape(d.nome)}</xNome>
        <enderDest>
          <xLgr>${xmlEscape(de.logradouro)}</xLgr>
          <nro>${xmlEscape(de.numero)}</nro>${destXCpl}
          <xBairro>${xmlEscape(de.bairro)}</xBairro>
          <cMun>${de.codigoMunicipio}</cMun>
          <xMun>${xmlEscape(de.municipio)}</xMun>
          <UF>${de.uf}</UF>
          <CEP>${de.cep.replace(/\D/g, "")}</CEP>
          <cPais>${de.codigoPais}</cPais>
          <xPais>${xmlEscape(de.nomePais)}</xPais>
        </enderDest>
        <indIEDest>${d.indIEDest}</indIEDest>${destIeXml}
      </dest>
${autXml}
${detXml}
      <total>
        ${totBlock}
      </total>
${transpXml(emitter.modFrete, fiscal, totalQty)}
${pagBlock()}
${infIntermedBlock(fiscal)}${infAdic}${infRespTec}
    </infNFe>
  </NFe>
${protNFeBlock(nfe, dhEmi)}
</nfeProc>`;
}

/** Remessa simbólica — ML: tpNF=1, NFref, tributos da engine/planilha, idDest dinâmico. */
function buildRemessaSimbolicaNFeXML(
  nfe: NFeXmlInput,
  emit: EmitenteXml,
  product?: ProductXmlInput,
  emitterSettings?: FiscalEmitterSettingsData | null,
): string {
  return buildRemessaNFeXML(nfe, emit, product, emitterSettings);
}

/** Retorno simbólico — ML: tpNF=0 (entrada), NFref→remessa; tributos da engine/planilha. */
function buildRetornoNFeXML(
  nfe: NFeXmlInput,
  emit: EmitenteXml,
  product?: ProductXmlInput,
  emitterSettings?: FiscalEmitterSettingsData | null,
): string {
  const id = "NFe" + nfe.chave;
  const dhEmi = formatNfeDateTime(nfe.emitidaEm);
  const e = emit.endereco;
  const xCplXml = e.xCpl ? `\n          <xCpl>${xmlEscape(e.xCpl)}</xCpl>` : "";
  const foneXml = e.fone ? `\n          <fone>${e.fone.replace(/\D/g, "")}</fone>` : "";
  const iestXml = emit.iest ? `\n        <IEST>${emit.iest.replace(/\D/g, "")}</IEST>` : "";

  const qCom = nfe.quantidade;
  const cProd = product?.sku ?? `SKU-${nfe.numero}`;
  const cEAN = formatEanForXml(product?.ean);
  const xProd = product?.nome ?? nfe.natOp;
  const ncm = product?.ncm ?? nfe.ncm;
  const cfop = nfe.cfop;
  const uCom = product?.unidade ?? "UNID";
  const orig = product?.origem ?? 1;
  const fiscal = (nfe.fiscalPayload ?? {}) as Record<string, unknown>;
  const engine = parseEngineFromFiscalPayload(fiscal);
  const engineItem = engine?.itens[0];
  const vUnCom = engineItem?.valorUnitario ?? productUnitPriceForNfe(product, nfe);
  const vProd = engineItem?.vProd ?? lineTotal(vUnCom, qCom);
  const cestXml = product?.cest ? `\n          <CEST>${product.cest}</CEST>` : "";
  const exTipiXml = product?.exTipi
    ? `\n          <EXTIPI>${product.exTipi}</EXTIPI>`
    : typeof fiscal.exTipi === "string" && fiscal.exTipi
      ? `\n          <EXTIPI>${fiscal.exTipi}</EXTIPI>`
      : "";
  const nfciRaw =
    (typeof fiscal.nfci === "string" && fiscal.nfci) ||
    (typeof (product as { nfci?: string } | undefined)?.nfci === "string"
      ? (product as { nfci?: string }).nfci
      : "");
  const nfciXml = nfciRaw ? `\n          <nFCI>${xmlEscape(nfciRaw)}</nFCI>` : "";

  const d = nfe.destinatario;
  const de = d.endereco;
  const docDigits = d.doc.replace(/\D/g, "");
  const destXCpl = destComplementoXml(de.complemento);
  const destIeXml = destIeXmlFromPayload(d.indIEDest, fiscal, d.ie);
  const cUF = ufToCodigo(e.uf);
  const infAdProd = nfe.pedidoML ? `\n        <infAdProd>xPed:${xmlEscape(nfe.pedidoML)}</infAdProd>` : "";
  const emitter = resolveEmitterFromPayload(fiscal, emitterSettings ?? null, nfe.tipo, vProd, nfe.valorICMS);
  const vFrete = emitter.freteNoCalculo ? emitter.bases.vFrete : 0;
  const destIe =
    (typeof fiscal.destIe === "string" && fiscal.destIe) || (typeof d.ie === "string" && d.ie) || "";
  const idDest = idDestFromUfs(e.uf, de.uf);
  const infAdic = infAdicXml(nfe, emitter, retornoInfCplText());
  const autXml = autXmlBlock(fiscal);
  const fulfillment = hasMlFulfillmentPayload(fiscal);

  const icmsSnap = (fiscal.icms as Record<string, unknown> | undefined) ?? {
    cst: "00",
    aliquota: nfe.aliqICMS,
  };
  const vBcIcms = asNum(icmsSnap.vBc, emitter.bases.vBcIcms);
  const valorIcms = asNum(icmsSnap.valorIcms, nfe.valorICMS);
  const { icmsXml, ipiXml, pisCofinsXml } = buildItemImpostoXml({
    engineItem,
    fiscal,
    emitter,
    icmsSnapshotFallback: {
      orig,
      icms: icmsSnap,
      vBcIcms,
      valorIcms,
    },
  });

  let icmsTot: string;
  if (engineItem && engine) {
    icmsTot = icmsTotBlock(icmsTotFromEngine(engine.totais, vFrete), idDest === 2);
  } else {
    icmsTot = icmsTotBlock(
      {
        vBC: vBcIcms,
        vICMS: valorIcms,
        vProd,
        vFrete,
        vIPI: 0,
        vPIS: 0,
        vCOFINS: 0,
        vNF: vProd,
      },
      idDest === 2,
    );
  }
  const ibsCbs = (fiscal.ibsCbs as Record<string, unknown> | undefined) ?? {};
  const retornoIbsCbsBcInput = engineItem
    ? ibsCbsBcInputFromEngineItem(engineItem)
    : ibsCbsBcInputFromSnapshot(
        vProd,
        fiscal,
        asNum(
          ((fiscal.icms as Record<string, unknown> | undefined) ?? {}).valorIcms,
          nfe.valorICMS,
        ),
      );
  const retornoVBcIbsCbs = fulfillment
    ? resolveIbsCbsItemVBc(ibsCbs, retornoIbsCbsBcInput, REMESSA_IBS_CBS_DEFAULTS)
    : null;
  const totBlock = fulfillment
    ? totalBlock(icmsTot, vProd, {
        includeReformaTributaria: true,
        vBCIBSCBS: retornoVBcIbsCbs != null ? sumIbsCbsVBc([retornoVBcIbsCbs]) : 0,
      })
    : icmsTot;
  const infRespTec = `\n${infRespTecXml(ML_INF_RESP_TEC)}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="${id}" versao="4.00">
      <ide>
        <cUF>${cUF}</cUF>
        <cNF>${nfe.chave.slice(35, 43)}</cNF>
        <natOp>${xmlEscape(nfe.natOp)}</natOp>
        <mod>55</mod>
        <serie>${nfe.serie}</serie>
        <nNF>${nfe.numero}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <dhSaiEnt>${dhEmi}</dhSaiEnt>
        <tpNF>0</tpNF>
        <idDest>${idDestFromUfs(e.uf, de.uf)}</idDest>
        <cMunFG>${e.cMun}</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${nfe.chave.slice(-1)}</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>0</indFinal>
        <indPres>2</indPres>
        <indIntermed>1</indIntermed>
        <procEmi>0</procEmi>
        <verProc>invoice-SIMULATION</verProc>${ideNfRefXml(nfe)}
      </ide>
      <emit>
        <CNPJ>${emit.cnpj.replace(/\D/g, "")}</CNPJ>
        <xNome>${xmlEscape(emit.xNome)}</xNome>
        <enderEmit>
          <xLgr>${xmlEscape(e.xLgr)}</xLgr>
          <nro>${xmlEscape(e.nro)}</nro>${xCplXml}
          <xBairro>${xmlEscape(e.xBairro)}</xBairro>
          <cMun>${e.cMun}</cMun>
          <xMun>${xmlEscape(e.xMun)}</xMun>
          <UF>${e.uf}</UF>
          <CEP>${e.cep.replace(/\D/g, "")}</CEP>
          <cPais>${e.cPais}</cPais>
          <xPais>${xmlEscape(e.xPais)}</xPais>${foneXml}
        </enderEmit>
        <IE>${emit.ie.replace(/\D/g, "")}</IE>${iestXml}
        <CRT>${emit.crt}</CRT>
      </emit>
      <dest>
        <CNPJ>${docDigits}</CNPJ>
        <xNome>${xmlEscape(d.nome)}</xNome>
        <enderDest>
          <xLgr>${xmlEscape(de.logradouro)}</xLgr>
          <nro>${xmlEscape(de.numero)}</nro>${destXCpl}
          <xBairro>${xmlEscape(de.bairro)}</xBairro>
          <cMun>${de.codigoMunicipio}</cMun>
          <xMun>${xmlEscape(de.municipio)}</xMun>
          <UF>${de.uf}</UF>
          <CEP>${de.cep.replace(/\D/g, "")}</CEP>
          <cPais>${de.codigoPais}</cPais>
          <xPais>${xmlEscape(de.nomePais)}</xPais>
        </enderDest>
        <indIEDest>${d.indIEDest}</indIEDest>${destIeXml}
      </dest>
${autXml}      <det nItem="1">
        <prod>
          <cProd>${xmlEscape(cProd)}</cProd>
          <cEAN>${cEAN}</cEAN>
          <xProd>${xmlEscape(xProd)}</xProd>
          <NCM>${ncm}</NCM>${cestXml}${exTipiXml}
          <CFOP>${cfop}</CFOP>
          <uCom>${xmlEscape(uCom)}</uCom>
          <qCom>${formatNfeQuantity(qCom)}</qCom>
          <vUnCom>${vUnCom.toFixed(8)}</vUnCom>
          <vProd>${vProd.toFixed(2)}</vProd>
          <cEANTrib>${cEAN}</cEANTrib>
          <uTrib>${xmlEscape(uCom)}</uTrib>
          <qTrib>${formatNfeQuantity(qCom)}</qTrib>
          <vUnTrib>${vUnCom.toFixed(8)}</vUnTrib>
          <indTot>1</indTot>${nfciXml}
        </prod>
        <imposto>
          <vTotTrib>0.00</vTotTrib>
          ${icmsXml}
          ${ipiXml}
          ${pisCofinsXml}${fulfillmentImpostoExtras(fiscal, retornoVBcIbsCbs)}
        </imposto>${infAdProd}${fulfillmentDetTail(fiscal, vProd)}
      </det>
      <total>
        ${totBlock}
      </total>
${transpXml(emitter.modFrete, fiscal, qCom)}
${pagBlock()}
${infIntermedBlock(fiscal)}${infAdic}${infRespTec}
    </infNFe>
  </NFe>
${protNFeBlock(nfe, dhEmi)}
</nfeProc>`;
}

function buildVendaNFeXML(
  nfe: NFeXmlInput,
  emit: EmitenteXml,
  product?: ProductXmlInput,
  emitterSettings?: FiscalEmitterSettingsData | null,
): string {
  const id = "NFe" + nfe.chave;
  const dhEmi = formatNfeDateTime(nfe.emitidaEm);
  const e = emit.endereco;
  const xCplXml = e.xCpl ? `\n          <xCpl>${xmlEscape(e.xCpl)}</xCpl>` : "";
  const foneXml = e.fone ? `\n          <fone>${e.fone.replace(/\D/g, "")}</fone>` : "";
  const iestXml = emit.iest ? `\n        <IEST>${emit.iest.replace(/\D/g, "")}</IEST>` : "";

  const qCom = nfe.quantidade ?? 1;
  const cProd = product?.sku ?? `SKU-${nfe.numero}`;
  const cEAN = formatEanForXml(product?.ean);
  const xProd = product?.nome ?? nfe.natOp;
  const ncm = product?.ncm ?? nfe.ncm;
  const cfop = nfe.cfop;
  const uCom = product?.unidade ?? "UN";
  const vUnCom = productUnitPriceForNfe(product, nfe);
  const vProd = nfe.valor;
  const orig = product?.origem ?? 0;
  const cestXml = product?.cest ? `\n          <CEST>${product.cest}</CEST>` : "";
  const exTipiXml = product?.exTipi ? `\n          <EXTIPI>${product.exTipi}</EXTIPI>` : "";

  const d = nfe.destinatario;
  const de = d.endereco;
  const docDigits = d.doc.replace(/\D/g, "");
  const docTag = d.docTipo === "CNPJ" ? "CNPJ" : "CPF";
  const destXCpl = de.complemento ? `\n          <xCpl>${xmlEscape(de.complemento)}</xCpl>` : "";
  const destFone = de.telefone ? `\n          <fone>${de.telefone.replace(/\D/g, "")}</fone>` : "";
  const cUF = ufToCodigo(e.uf);

  const fiscal = (nfe.fiscalPayload ?? {}) as Record<string, unknown>;
  const engine = parseEngineFromFiscalPayload(fiscal);
  const icms = (fiscal.icms as Record<string, unknown> | undefined) ?? {};
  const ipi = (fiscal.ipi as Record<string, unknown> | undefined) ?? {};
  const pis = (fiscal.pis as Record<string, unknown> | undefined) ?? {};
  const cofins = (fiscal.cofins as Record<string, unknown> | undefined) ?? {};
  const ibsCbs = (fiscal.ibsCbs as Record<string, unknown> | undefined) ?? {};
  const emitter = resolveEmitterFromPayload(fiscal, emitterSettings ?? null, nfe.tipo, nfe.valor, nfe.valorICMS);
  const vFrete = emitter.freteNoCalculo ? emitter.bases.vFrete : 0;
  const finNFe = 1;
  const idDest = idDestFromUfs(e.uf, de.uf);

  let icmsXml: string;
  let ipiXml: string;
  let pisCofinsXml: string;
  let totBlock: string;
  let vUnComOut = vUnCom;
  let vProdOut = vProd;
  let qComOut = qCom;

  if (engine?.itens[0]) {
    const item = engine.itens[0];
    icmsXml = buildIcmsXmlFromEngineItem(item.icms);
    ipiXml = item.ipi ? buildIpiXmlFromEngine(item.ipi) : impostoIpiIntXml("50");
    pisCofinsXml = buildPisCofinsXmlFromEngine(item.pis, item.cofins);
    totBlock = icmsTotBlock(icmsTotFromEngine(engine.totais, vFrete), idDest === 2);
    vUnComOut = item.valorUnitario;
    vProdOut = item.vProd;
    qComOut = item.quantidade;
  } else {
    const vBcIcms = asNum(icms.vBc, emitter.bases.vBcIcms);
    const vBcPis = asNum(pis.vBc, emitter.bases.vBcPisCofins);
    const vBcIpi = asNum(ipi.vBc, emitter.bases.vBcIpi);
    const valorIcms = asNum(icms.valorIcms, nfe.valorICMS);
    const pIpi = asNum(ipi.aliquota, 0);
    const vIpi = Math.round((vBcIpi * (pIpi / 100)) * 100) / 100;
    const pPis = asNum(pis.aliquota, 1.65);
    const vPis = Math.round((vBcPis * (pPis / 100)) * 100) / 100;
    const pCofins = asNum(cofins.aliquota, 7.6);
    const vCofins = Math.round((vBcPis * (pCofins / 100)) * 100) / 100;
    const cstPis = typeof pis.st === "string" ? pis.st.slice(0, 2) : "01";
    const cstCofins = typeof cofins.st === "string" ? cofins.st.slice(0, 2) : "01";
    const cstIpi = typeof ipi.st === "string" ? ipi.st.slice(0, 2) : "50";
    const cenq = fiscalCodeText(ipi.codEnq, "999");

    icmsXml = buildIcmsXmlFromSnapshot(icms, { orig, valor: vBcIcms, valorIcms });
    ipiXml =
      startsWithTaxCode(ipi.st, "55") || startsWithTaxCode(ipi.st, "54") || startsWithTaxCode(ipi.st, "53")
        ? `<IPI><cEnq>${cenq}</cEnq><IPINT><CST>${cstIpi}</CST></IPINT></IPI>`
        : `<IPI><cEnq>${cenq}</cEnq><IPITrib><CST>${cstIpi}</CST><vBC>${vBcIpi.toFixed(2)}</vBC><pIPI>${pIpi.toFixed(2)}</pIPI><vIPI>${vIpi.toFixed(2)}</vIPI></IPITrib></IPI>`;
    pisCofinsXml = `<PIS><PISAliq><CST>${cstPis}</CST><vBC>${vBcPis.toFixed(2)}</vBC><pPIS>${pPis.toFixed(2)}</pPIS><vPIS>${vPis.toFixed(2)}</vPIS></PISAliq></PIS>
          <COFINS><COFINSAliq><CST>${cstCofins}</CST><vBC>${vBcPis.toFixed(2)}</vBC><pCOFINS>${pCofins.toFixed(2)}</pCOFINS><vCOFINS>${vCofins.toFixed(2)}</vCOFINS></COFINSAliq></COFINS>`;

    const vNF = Math.round((nfe.valor + vFrete + vIpi) * 100) / 100;
    const difalFiscal = (fiscal.difal as Record<string, unknown> | undefined) ?? {};
    const interstate = idDest === 2;
    totBlock = icmsTotBlock(
      {
        vBC: vBcIcms,
        vICMS: valorIcms,
        vProd: nfe.valor,
        vFrete,
        vIPI: vIpi,
        vPIS: vPis,
        vCOFINS: vCofins,
        vNF,
        vFCPUFDest: interstate ? asNum(difalFiscal.vFCPUFDest, 0) : undefined,
        vICMSUFDest: interstate ? asNum(difalFiscal.vICMSUFDest, emitter.difal.vDifal) : undefined,
        vICMSUFRemet: interstate ? asNum(difalFiscal.vICMSUFRemet, 0) : undefined,
      },
      interstate,
    );
  }

  const vendaIbsCbsBcInput = engine?.itens[0]
    ? ibsCbsBcInputFromEngineItem(engine.itens[0])
    : ibsCbsBcInputFromSnapshot(vProdOut, fiscal, asNum(icms.valorIcms, nfe.valorICMS));
  const hasIbsCbsPayload =
    ibsCbs.st != null || ibsCbs.cst != null || ibsCbs.cClassTrib != null;
  const vendaVBcIbsCbs = hasIbsCbsPayload
    ? resolveIbsCbsItemVBc(ibsCbs, vendaIbsCbsBcInput, VENDA_IBS_CBS_DEFAULTS)
    : null;
  const ibsCbsXml = ibsCbsImpostoXmlFromPayload(ibsCbs, vendaVBcIbsCbs);
  if (ibsCbsXml) {
    const vNFTotal = engine?.totais.vNF ?? nfe.valor + vFrete;
    totBlock = totalBlock(totBlock, vNFTotal, {
      includeReformaTributaria: true,
      vBCIBSCBS: vendaVBcIbsCbs != null ? sumIbsCbsVBc([vendaVBcIbsCbs]) : 0,
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="${id}" versao="4.00">
      <ide>
        <cUF>${cUF}</cUF>
        <cNF>${nfe.chave.slice(35, 43)}</cNF>
        <natOp>${xmlEscape(nfe.natOp)}</natOp>
        <mod>55</mod>
        <serie>${nfe.serie}</serie>
        <nNF>${nfe.numero}</nNF>
        <dhEmi>${dhEmi}</dhEmi>
        <dhSaiEnt>${dhEmi}</dhSaiEnt>
        <tpNF>1</tpNF>
        <idDest>${idDest}</idDest>
        <cMunFG>${e.cMun}</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${nfe.chave.slice(-1)}</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>${finNFe}</finNFe>
        <indFinal>1</indFinal>
        <indPres>2</indPres>
        <indIntermed>1</indIntermed>
        <procEmi>0</procEmi>
        <verProc>fiscal-engine-3.2-SIMULATION</verProc>${ideNfRefXml(nfe)}
      </ide>
      <emit>
        <CNPJ>${emit.cnpj.replace(/\D/g, "")}</CNPJ>
        <xNome>${xmlEscape(emit.xNome)}</xNome>
        <xFant>${xmlEscape(emit.xFant)}</xFant>
        <enderEmit>
          <xLgr>${xmlEscape(e.xLgr)}</xLgr>
          <nro>${xmlEscape(e.nro)}</nro>${xCplXml}
          <xBairro>${xmlEscape(e.xBairro)}</xBairro>
          <cMun>${e.cMun}</cMun>
          <xMun>${xmlEscape(e.xMun)}</xMun>
          <UF>${e.uf}</UF>
          <CEP>${e.cep.replace(/\D/g, "")}</CEP>
          <cPais>${e.cPais}</cPais>
          <xPais>${xmlEscape(e.xPais)}</xPais>${foneXml}
        </enderEmit>
        <IE>${emit.ie.replace(/\D/g, "")}</IE>${iestXml}
        <CRT>${emit.crt}</CRT>
      </emit>
      <dest>
        <${docTag}>${docDigits}</${docTag}>
        <xNome>${xmlEscape(d.nome)}</xNome>
        <enderDest>
          <xLgr>${xmlEscape(de.logradouro)}</xLgr>
          <nro>${xmlEscape(de.numero)}</nro>${destXCpl}
          <xBairro>${xmlEscape(de.bairro)}</xBairro>
          <cMun>${de.codigoMunicipio}</cMun>
          <xMun>${xmlEscape(de.municipio)}</xMun>
          <UF>${de.uf}</UF>
          <CEP>${de.cep.replace(/\D/g, "")}</CEP>
          <cPais>${de.codigoPais}</cPais>
          <xPais>${xmlEscape(de.nomePais)}</xPais>${destFone}
        </enderDest>
        <indIEDest>${d.indIEDest}</indIEDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>${xmlEscape(cProd)}</cProd>
          <cEAN>${cEAN}</cEAN>
          <xProd>${xmlEscape(xProd)}</xProd>
          <NCM>${ncm}</NCM>${cestXml}${exTipiXml}
          <CFOP>${cfop}</CFOP>
          <uCom>${xmlEscape(uCom)}</uCom>
          <qCom>${qComOut.toFixed(4)}</qCom>
          <vUnCom>${vUnComOut.toFixed(8)}</vUnCom>
          <vProd>${vProdOut.toFixed(2)}</vProd>
          <cEANTrib>${cEAN}</cEANTrib>
          <uTrib>${xmlEscape(uCom)}</uTrib>
          <qTrib>${qComOut.toFixed(4)}</qTrib>
          <vUnTrib>${vUnComOut.toFixed(8)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          ${icmsXml}
          ${ipiXml}
          ${pisCofinsXml}
          ${ibsCbsXml}
        </imposto>
      </det>
      <total>
        ${totBlock}
      </total>
${transpXml(emitter.modFrete, fiscal, qComOut)}
${pagBlock()}
${infIntermedBlock(fiscal)}${infAdicXml(nfe, emitter)}
    </infNFe>
  </NFe>
${protNFeBlock(nfe, dhEmi)}
</nfeProc>`;
}

function buildDevolucaoNFeXML(
  nfe: NFeXmlInput,
  emit: EmitenteXml,
  product?: ProductXmlInput,
  emitterSettings?: FiscalEmitterSettingsData | null,
): string {
  const base = buildVendaNFeXML(nfe, emit, product, emitterSettings);
  return base
    .replace("<tpNF>1</tpNF>", "<tpNF>0</tpNF>")
    .replace("<finNFe>1</finNFe>", "<finNFe>4</finNFe>")
    .replace(
      /<natOp>[^<]*<\/natOp>/,
      `<natOp>${xmlEscape(nfe.natOp || "Devolução de mercadoria")}</natOp>`,
    );
}

/** procEventoNFe — cancelamento (tpEvento 110111), alinhado aos XMLs ML. */
export function buildProcEventoCancelamentoXML(
  nfe: NFeXmlInput,
  emit: EmitenteXml,
  evento: FiscalEventoXmlInput,
): string {
  const cOrgao = String(ufToCodigo(emit.uf) ?? 41).padStart(2, "0");
  const cnpj = emit.cnpj.replace(/\D/g, "");
  const dhEvento = formatNfeDateTime(evento.ocorridoEm);
  const dhReg = formatNfeDateTime(evento.ocorridoEm);
  const nProtNfe = simulationNProt(nfe.numero, "141260055765");
  const xJust = xmlEscape(evento.xJust?.trim() || "Cancelamento solicitado pelo emissor");
  const infEventoId = `ID110111${nfe.chave}01`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?><procEventoNFe versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe"><evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${infEventoId}"><cOrgao>${cOrgao}</cOrgao><tpAmb>1</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${nfe.chave}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${nProtNfe}</nProt><xJust>${xJust}</xJust></detEvento></infEvento></evento><retEvento versao="1.00"><infEvento><tpAmb>1</tpAmb><verAplic>PR-v4_9_62</verAplic><cOrgao>${cOrgao}</cOrgao><cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo><chNFe>${nfe.chave}</chNFe><tpEvento>110111</tpEvento><xEvento>Cancelamento</xEvento><nSeqEvento>1</nSeqEvento><dhRegEvento>${dhReg}</dhRegEvento><nProt>${ensureNProt(evento.protocolo, nfe.numero)}</nProt></infEvento></retEvento></procEventoNFe>`;
  return injectSimulationSignature(xml, EVENTO_SIGNATURE_CONFIG);
}

/** Lightweight XML pretty token highlighter (tag, attr, value). */
export function highlightXML(xml: string): { kind: "tag" | "attr" | "value" | "text" | "comment"; text: string }[] {
  const tokens: { kind: "tag" | "attr" | "value" | "text" | "comment"; text: string }[] = [];
  const re = /(<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<\/?[^>]+>)|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1]) {
      const tag = m[1];
      const inner = tag.replace(/^<\/?|\/?>$|\?>$|^<\?/g, "");
      const parts = inner.split(/\s+/);
      tokens.push({
        kind: "tag",
        text:
          tag.startsWith("<?") || tag.startsWith("<!--")
            ? tag.split(" ")[0]!
            : `<${tag.startsWith("</") ? "/" : ""}${parts[0]}`,
      });
      for (let i = 1; i < parts.length; i++) {
        const a = parts[i];
        if (a?.includes("=")) {
          const [k, v] = a.split("=");
          tokens.push({ kind: "text", text: " " });
          tokens.push({ kind: "attr", text: k! });
          tokens.push({ kind: "text", text: "=" });
          tokens.push({ kind: "value", text: v! });
        } else if (a) {
          tokens.push({ kind: "text", text: " " + a });
        }
      }
      tokens.push({ kind: "tag", text: tag.endsWith("/>") ? "/>" : ">" });
    } else if (m[2]) {
      tokens.push({ kind: "text", text: m[2] });
    }
  }
  return tokens;
}
