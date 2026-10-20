import type { createLookupModule } from "./infrastructure/factory/lookup-module.factory.js";

/** Composition root do Lookup (use cases + gateways), injetado nos controllers Nest. */
export const LOOKUP = Symbol("LOOKUP");

export type LookupContext = ReturnType<typeof createLookupModule>;
