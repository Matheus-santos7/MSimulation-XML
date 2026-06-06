/**
 * Reexporta o gerador de XML do pacote compartilhado.
 * Preferir download via API (`getNfeXml`) para NF-e com XML persistido (REMESSA).
 */
export {
  buildNFeXML,
  buildProcEventoCancelamentoXML,
  highlightXML,
  parseEngineFromFiscalPayload,
} from "@msimulation-xml/nfe-xml";
