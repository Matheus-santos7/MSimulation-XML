/**
 * @msimulation-xml/nfe-xml — geração de XML NF-e (simulação).
 *
 * Arquitetura: Factory + Strategy builders → AST → XmlSerializer.
 * Tributos: `fiscalPayload.engine` quando presente (fonte: tax-engine no backend).
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
export { buildProcEventoCancelamentoXML } from "./core/proc-evento.builder.js";
export { highlightXML, type XmlHighlightToken } from "./core/xml-highlighter.js";
export {
  XmlSerializer,
  escapeXml,
  serializeXmlDocument,
  serializeXmlObject,
  type XmlDocument,
  type XmlNodeValue,
  type XmlObject,
  type XmlPrimitive,
  type XmlSerializerOptions,
} from "./core/xml-serializer.js";
export type {
  NfeAutXml,
  NfeCard,
  NfeDet,
  NfeDest,
  NfeDetPag,
  NfeEmit,
  NfeEndereco,
  NfeEnvelope,
  NfeIcmsTot,
  NfeIde,
  NfeImposto,
  NfeInfAdic,
  NfeInfIntermed,
  NfeInfNFe,
  NfeInfProt,
  NfeInfRespTec,
  NfeNfRef,
  NfeObsCont,
  NfePag,
  NfeProc,
  NfeProcDocument,
  NfeProd,
  NfeProtNFe,
  NfeTotal,
  NfeTransp,
  NfeTransporta,
  NfeVol,
  NfeDecimal,
  NfeInfId,
  NfeIcmsImposto,
  NfeIpiImposto,
  NfePisCofinsImposto,
  NfeIbsCbsImposto,
} from "./core/nfe-ast.types.js";
export { resolveEmitterFromPayload } from "./resolve-emitter.js";
export {
  resolveIcmsFromSnapshot,
  resolveIcmsFromEngine,
  resolveIpiInt,
  resolveIpiFromEngine,
  resolveIpiFromSnapshot,
  resolvePisCofinsFromEngine,
  resolveIbsCbsImposto,
  resolveIbsCbsImpostoVenda,
  resolveIbsCbsImpostoRemessa,
  type IcmsSnapshotContext,
  type IbsCbsImpostoInput,
} from "./taxes/index.js";
export type {
  EmitenteXml,
  FiscalEventoXmlInput,
  NFeTipoXml,
  NFeXmlInput,
  ProductXmlInput,
} from "./types.js";
export {
  BaseNFeBuilder,
  DevolucaoNFeStrategyBuilder,
  RemessaNFeStrategyBuilder,
  RetornoSimbolicoNFeStrategyBuilder,
  VendaNFeStrategyBuilder,
  buildDevolucaoNFeProcDocument,
  buildDevolucaoNFeXml,
  buildRemessaNFeProcDocument,
  buildRemessaNFeXml,
  buildRetornoNFeProcDocument,
  buildRetornoNFeXml,
  buildVendaNFeProcDocument,
  buildVendaNFeXml,
  type BaseNFeBuildContext,
  type NFeBuilderInput,
  type NFeBuilderResult,
} from "./builders/index.js";
export {
  NFE_BUILDER_SUPPORTED,
  UnsupportedNfeBuilderTipoError,
  buildNFeProcDocument,
  buildNFeXmlFromBuilder,
  createNFeBuilder,
  isNfeBuilderSupported,
  type NFeFactoryInput,
} from "./core/nfe-factory.js";
export {
  type IbsCbsDefaults,
  type IbsCbsVBcInput,
  type IcmsTotValues,
  REMESSA_IBS_CBS_DEFAULTS,
  VENDA_IBS_CBS_DEFAULTS,
  calcIbsCbsItemVBc,
  calcIbsCbsVendaValues,
  formatNfeQuantity,
  remessaInfCplText,
  remessaSimbolicaPosDevolucaoInfCplText,
  resolveAutXmlCpfs,
  resolveIbsCbsItemVBc,
  resolveIdCadIntTran,
  resolveRemessaTranspVol,
  resolveTransportaFromFiscal,
  retornoInfCplText,
  roundMoney,
  sumIbsCbsVBc,
} from "./fiscal/fiscal-xml.util.js";
