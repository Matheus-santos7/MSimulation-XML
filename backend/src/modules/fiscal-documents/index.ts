/**
 * API pública do fiscal-documents para os módulos que emitem notas (remessas, vendas) e para
 * a configuração fiscal. Expõe chave, numeração, XML e mappers de NF-e e CT-e; os use cases
 * do ciclo de vida ficam dentro do `FiscalDocumentsModule`.
 */
export { dadosCteToPrismaCreate, montarDadosCteFromNfe } from "./cte/rules/cte-emissao.js";
export type { DadosCteEmissao } from "./cte/rules/cte-emissao.js";
export { proximoNumeroCte } from "./cte/rules/cte-sequencia.js";
export {
  buildCteXmlAutorizado,
  persistCteFromEmission,
  persistCteXmlAutorizado,
  resolveCteXml,
} from "./cte/xml/cte-xml.service.js";
export {
  DocumentCancellationError,
  DocumentReturnError,
  NumberInutilizationError,
} from "./errors/fiscal-documents.errors.js";
export { buildChaveNFe, gerarPedidoMl, ufToCodigo } from "./nfe/rules/nfe-chave.js";
export {
  listInutilizacoesSerie,
  proximoNumeroNfe,
  ultimoNumeroNfe,
} from "./nfe/rules/nfe-sequencia.js";
export { PrismaNfeXmlContentResolverAdapter } from "./nfe/xml/nfe-xml-content.resolver.js";
export {
  buildNfeXmlAutorizado,
  persistNfeXmlAutorizado,
  persistNfeXmlFromEmission,
  resolveNfeCancelamentoEventoXml,
  resolveNfeXml,
} from "./nfe/xml/nfe-xml.service.js";
export { mapCte, mapNfe, num } from "./shared/fiscal-document.mapper.js";
export { fiscalNotDeleted } from "./shared/fiscal-not-deleted.js";
