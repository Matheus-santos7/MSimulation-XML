import type { createLogisticsModule } from "./infrastructure/factory/logistics-module.factory.js";

/** Composition root de Logistics, injetado nos controllers Nest. */
export const LOGISTICS = Symbol("LOGISTICS");

export type LogisticsContext = ReturnType<typeof createLogisticsModule>;
