import type { createTaxModule } from "./infrastructure/factory/tax-module.factory.js";

/** Composition root de Tax, injetado nos controllers Nest. */
export const TAX = Symbol("TAX");

export type TaxContext = ReturnType<typeof createTaxModule>;
