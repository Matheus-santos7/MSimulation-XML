import type { createSalesModule } from "./infrastructure/factory/sales-module.factory.js";

/** Composition root de Sales (pedidos e cadeia fiscal de venda), injetado nos controllers Nest. */
export const SALES = Symbol("SALES");

export type SalesContext = ReturnType<typeof createSalesModule>;
