import type { FiscalEmitterSettingsData } from "./rules/fiscal-emitter-settings-defaults.js";

/** Resumo de numeração de NF-e por série lógica (leitura na UI). */
export type NfeNumeracaoView = {
  numeroInicial: number;
  ultimoEmitido: number | null;
  proximoNumero: number;
};

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
  /** Numeração NF-e por série lógica (remessa/venda e transferência). */
  numeracaoNfe: {
    remessa: NfeNumeracaoView;
    transferencia: NfeNumeracaoView;
  };
  /** Configuração fiscal completa: `basic`, `taxes`, `nfe`. */
  settings: FiscalEmitterSettingsData;
}

/**
 * Patch parcial das configurações do emissor (body do `PATCH /fiscal-settings`).
 *
 * Seções `basic`, `taxes` e `nfe` são mescladas em profundidade. `serieRemessa`,
 * `serieTransferencia` e `serieCte` atualizam colunas do `tenant`, não o JSON.
 */
export interface UpdateEmitterSettingsInput {
  basic?: Record<string, unknown>;
  taxes?: Record<string, unknown>;
  nfe?: Record<string, unknown>;
  serieRemessa?: number;
  serieTransferencia?: number;
  serieCte?: number;
}
