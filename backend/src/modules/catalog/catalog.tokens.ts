import type { createCatalogModule } from "./infrastructure/factory/catalog-module.factory.js";

/** Composition root do Catalog, injetado nos controllers Nest. */
export const CATALOG = Symbol("CATALOG");

export type CatalogContext = ReturnType<typeof createCatalogModule>;
