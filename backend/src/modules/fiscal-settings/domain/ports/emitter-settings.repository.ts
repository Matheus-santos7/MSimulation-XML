import type { EmitterSettingsView, NfeNumeracaoView } from "../entities/emitter-settings-view.entity.js";

/**
 * Patch parcial das configurações do emissor (body do `PATCH /fiscal-settings`).
 *
 * Secções `basic`, `taxes` e `nfe` são objetos JSON mergeados profundamente.
 * `serieRemessa` / `serieCte` atualizam colunas do `tenant`, não o JSON.
 */
export interface UpdateEmitterSettingsInput {
  basic?: Record<string, unknown>;
  taxes?: Record<string, unknown>;
  nfe?: Record<string, unknown>;
  serieRemessa?: number;
  serieTransferencia?: number;
  serieCte?: number;
}

/**
 * Port de leitura e escrita das configurações do emissor por tenant.
 */
export interface EmitterSettingsRepository {
  /**
   * Obtém vista agregada; retorna defaults se `fiscal_emitter_settings` não existir.
   * @returns `null` se tenant inexistente
   */
  getByTenantId(tenantId: string): Promise<EmitterSettingsView | null>;

  /**
   * Aplica patch e persiste em transação (`tenant` + `fiscal_emitter_settings`).
   * @returns Vista atualizada ou `null` se tenant inexistente
   */
  update(tenantId: string, input: UpdateEmitterSettingsInput): Promise<EmitterSettingsView | null>;

  /**
   * Consulta última NF-e emitida e próximo número para uma série informada.
   */
  getNumeracaoForSerie(
    tenantId: string,
    serie: number,
    numeroInicial: number,
  ): Promise<NfeNumeracaoView | null>;
}
