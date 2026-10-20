import type { createFiscalSettingsModule } from "./infrastructure/factory/fiscal-settings-module.factory.js";

/** Composition root de Fiscal Settings, injetado nos controllers Nest. */
export const FISCAL_SETTINGS = Symbol("FISCAL_SETTINGS");

export type FiscalSettingsContext = ReturnType<typeof createFiscalSettingsModule>;
