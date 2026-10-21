import type { createFiscalDocumentsModule } from "./infrastructure/factory/fiscal-documents-module.factory.js";

/** Composition root de Fiscal Documents (NF-e, CT-e e ciclo de vida), injetado nos controllers Nest. */
export const FISCAL_DOCUMENTS = Symbol("FISCAL_DOCUMENTS");

export type FiscalDocumentsContext = ReturnType<typeof createFiscalDocumentsModule>;
