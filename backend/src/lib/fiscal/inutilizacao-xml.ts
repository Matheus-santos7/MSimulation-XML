import { ensureNProt, injectSimulationSignature, INUT_SIGNATURE_CONFIG } from "@msimulation-xml/fiscal-core";
import { ufToCodigo } from "./nfe-chave.js";

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type InutilizacaoXmlInput = {
  emitenteUf: string;
  emitenteCnpj: string;
  serie: number;
  numeroIni: number;
  numeroFim: number;
  protocolo: string;
  ocorridoEm: string;
  xJust?: string;
};

export function infInutId(
  cUF: string,
  ano: string,
  cnpj: string,
  serie: number,
  nNFIni: number,
  nNFFin: number,
): string {
  return `ID${cUF}${ano}${cnpj}55${String(serie).padStart(3, "0")}${String(nNFIni).padStart(9, "0")}${String(nNFFin).padStart(9, "0")}`;
}

/** procInutNFe v4.00 — alinhado aos XMLs ML. */
export function buildProcInutNFeXML(emit: Pick<InutilizacaoXmlInput, "emitenteUf" | "emitenteCnpj">, inut: InutilizacaoXmlInput): string {
  const serie = inut.serie;
  const nNFIni = inut.numeroIni;
  const nNFFin = inut.numeroFim;
  const cUF = String(ufToCodigo(emit.emitenteUf)).padStart(2, "0");
  const ano = String(new Date(inut.ocorridoEm).getFullYear()).slice(-2);
  const cnpj = emit.emitenteCnpj.replace(/\D/g, "");
  const id = infInutId(cUF, ano, cnpj, serie, nNFIni, nNFFin);
  const xJust = xmlEscape(inut.xJust?.trim() || "Numero nao utilizado dentro do prazo legal");
  const dhRecbto = inut.ocorridoEm;

  const xml = `<?xml version="1.0" encoding="UTF-8"?><procInutNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><inutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><infInut Id="${id}"><tpAmb>1</tpAmb><xServ>INUTILIZAR</xServ><cUF>${cUF}</cUF><ano>${ano}</ano><CNPJ>${cnpj}</CNPJ><mod>55</mod><serie>${serie}</serie><nNFIni>${nNFIni}</nNFIni><nNFFin>${nNFFin}</nNFFin><xJust>${xJust}</xJust></infInut></inutNFe><retInutNFe versao="4.00"><nfeResultMsg><retInutNFe versao="4.00"><infInut><tpAmb>1</tpAmb><verAplic>PR-v4_9_62</verAplic><cStat>102</cStat><xMotivo>Inutilizacao de numero homologado</xMotivo><cUF>${cUF}</cUF><ano>${ano}</ano><CNPJ>${cnpj}</CNPJ><mod>55</mod><serie>${serie}</serie><nNFIni>${nNFIni}</nNFIni><nNFFin>${nNFFin}</nNFFin><dhRecbto>${dhRecbto}</dhRecbto><nProt>${ensureNProt(inut.protocolo, nNFIni)}</nProt></infInut></retInutNFe></nfeResultMsg></retInutNFe></procInutNFe>`;
  return injectSimulationSignature(xml, INUT_SIGNATURE_CONFIG);
}
