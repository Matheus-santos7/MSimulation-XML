import type { createRemessasModule } from "./infrastructure/factory/remessas-module.factory.js";

/** Composition root de Remessas (emissão de remessa e avanço entre CDs), sem rotas próprias. */
export const REMESSAS = Symbol("REMESSAS");

export type RemessasContext = ReturnType<typeof createRemessasModule>;
