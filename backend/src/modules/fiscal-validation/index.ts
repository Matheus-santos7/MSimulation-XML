/**
 * API pública do fiscal-validation. O fiscal-documents implementa o resolver de XML usado no
 * backfill; o resto do módulo fica dentro do `FiscalValidationModule`.
 */
export type {
  NfeRowForXmlResolution,
  NfeXmlContentResolver,
} from "./nfe-validation/types/nfe-xml-content-resolver.types.js";
