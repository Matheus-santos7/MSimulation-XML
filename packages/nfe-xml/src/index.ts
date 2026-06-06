/**
 * @msimulation-xml/nfe-xml — geração de XML NF-e (simulação).
 *
 * - Tributos: `fiscalPayload.engine` quando presente (fonte: tax-engine no backend).
 * - Persistência na emissão: apenas tipos em `NFE_XML_PERSIST_SUPPORTED` (fase REMESSA).
 */

export {
  NFE_XML_PERSIST_SUPPORTED,
  UnsupportedNfeXmlTipoError,
  isNfeXmlPersistSupported,
} from "./errors.js";
export { nfeProcXmlFilename } from "./filename.js";
export {
  buildIcmsXmlFromEngineItem,
  buildIpiXmlFromEngine,
  buildPisCofinsXmlFromEngine,
  icmsTotFromEngine,
  parseEngineFromFiscalPayload,
  type EngineItem,
  type EngineNota,
  type EngineTotais,
} from "./fiscal-engine-xml.js";
export { buildNFeXML, buildProcEventoCancelamentoXML, highlightXML } from "./nfe-xml-generator.js";
export { resolveEmitterFromPayload } from "./resolve-emitter.js";
export type {
  EmitenteXml,
  FiscalEventoXmlInput,
  NFeTipoXml,
  NFeXmlInput,
  ProductXmlInput,
} from "./types.js";
