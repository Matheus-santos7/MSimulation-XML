import type {
  EmitterSettingsRepository,
  UpdateEmitterSettingsInput,
} from "../../domain/ports/emitter-settings.repository.js";

/**
 * Atualiza configurações do emissor (PATCH parcial).
 *
 * Alterações em `basic` / `taxes` / `nfe` afetam emissões **futuras** via
 * `loadEmitterSettings` nos módulos sales, remessas e fiscal-documents.
 *
 * @param tenantId - Tenant emitente
 * @param input - Patch validado por Zod (`updateEmitterSettingsBodySchema`)
 * @returns Vista atualizada ou `null` se tenant inexistente
 */
export class UpdateEmitterSettingsUseCase {
  constructor(private readonly emitterSettings: EmitterSettingsRepository) {}

  execute(tenantId: string, input: UpdateEmitterSettingsInput) {
    return this.emitterSettings.update(tenantId, input);
  }
}
