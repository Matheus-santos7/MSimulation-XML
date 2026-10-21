import type { createFiscalValidationModule } from "./infrastructure/factory/fiscal-validation-module.factory.js";

/** Composition root de Fiscal Validation (com o resolver de XML de NF-e), injetado no Nest. */
export const FISCAL_VALIDATION = Symbol("FISCAL_VALIDATION");

export type FiscalValidationContext = ReturnType<typeof createFiscalValidationModule>;
