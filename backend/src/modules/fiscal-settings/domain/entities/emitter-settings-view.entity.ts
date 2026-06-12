import type { FiscalEmitterSettingsData } from "../../../../lib/fiscal/fiscal-emitter-settings-defaults.js";

/** Aggregated emitter configuration returned by the fiscal settings API. */
export interface EmitterSettingsView {
  tenantId: string;
  serieRemessa: number;
  serieCte: number;
  taxRulesCount: number;
  settings: FiscalEmitterSettingsData;
}

/** @deprecated Use EmitterSettingsView */
export type FiscalEmitterSettingsView = EmitterSettingsView;
