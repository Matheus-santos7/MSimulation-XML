import type { FiscalEmitterSettingsData } from "../../domain/services/fiscal-emitter-settings-defaults.js";

/**
 * Vista agregada das configurações do emissor fiscal de um tenant.
 *
 * Combina dados do `tenant` (séries), contagem de regras tributárias e o JSON
 * `FiscalEmitterSettingsData` efetivo (merge com defaults quando ausente).
 */
export interface EmitterSettingsView {
  tenantId: string;
  /** Série NF-e de remessa / retorno / venda (coluna `tenant.serie_remessa`). */
  serieRemessa: number;
  /** Série NF-e de transferência entre filiais (coluna `tenant.serie_transferencia`). */
  serieTransferencia: number;
  /** Série CT-e (coluna `tenant.serie_cte`). */
  serieCte: number;
  /** Grupos distintos de regras importadas (indicador de catálogo tax). */
  taxRulesCount: number;
  /** Configuração fiscal completa: `basic`, `taxes`, `nfe`. */
  settings: FiscalEmitterSettingsData;
}

/** @deprecated Use EmitterSettingsView */
export type FiscalEmitterSettingsView = EmitterSettingsView;
