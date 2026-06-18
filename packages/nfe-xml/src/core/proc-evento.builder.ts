/**
 * Builder de XML procEventoNFe (cancelamento simulado).
 *
 * @module core/proc-evento.builder
 */

import {
  ensureNProt,
  EVENTO_SIGNATURE_CONFIG,
  formatNfeDateTime,
  injectSimulationSignature,
  simulationNProt,
} from "@msimulation-xml/fiscal-core";
import { ufToCodigo } from "../constants.js";
import type { EmitenteXml, FiscalEventoXmlInput, NFeXmlInput } from "../types.js";
import { escapeXml } from "./xml-serializer.js";

/**
 * Monta `procEventoNFe` de cancelamento (tpEvento 110111), alinhado aos XMLs ML.
 */
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
  const xJust = escapeXml(evento.xJust?.trim() || "Cancelamento solicitado pelo emissor");
  const infEventoId = `ID110111${nfe.chave}01`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?><procEventoNFe versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe"><evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${infEventoId}"><cOrgao>${cOrgao}</cOrgao><tpAmb>1</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${nfe.chave}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${nProtNfe}</nProt><xJust>${xJust}</xJust></detEvento></infEvento></evento><retEvento versao="1.00"><infEvento><tpAmb>1</tpAmb><verAplic>PR-v4_9_62</verAplic><cOrgao>${cOrgao}</cOrgao><cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo><chNFe>${nfe.chave}</chNFe><tpEvento>110111</tpEvento><xEvento>Cancelamento</xEvento><nSeqEvento>1</nSeqEvento><dhRegEvento>${dhReg}</dhRegEvento><nProt>${ensureNProt(evento.protocolo, nfe.numero)}</nProt></infEvento></retEvento></procEventoNFe>`;
  return injectSimulationSignature(xml, EVENTO_SIGNATURE_CONFIG);
}
