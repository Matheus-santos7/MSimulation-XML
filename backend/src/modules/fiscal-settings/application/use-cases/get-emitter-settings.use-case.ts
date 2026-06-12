import type { EmitterSettingsRepository } from "../../domain/ports/emitter-settings.repository.js";

/**
 * Obtém configurações do emissor fiscal do tenant para a UI de settings.
 *
 * Mescla JSON persistido com {@link DEFAULT_FISCAL_EMITTER_SETTINGS} quando
 * o tenant ainda não personalizou as opções.
 *
 * @param tenantId - Tenant emitente (JWT)
 * @returns {@link EmitterSettingsView} ou `null` se empresa não existir
 */
export class GetEmitterSettingsUseCase {
  constructor(private readonly emitterSettings: EmitterSettingsRepository) {}

  execute(tenantId: string) {
    return this.emitterSettings.getByTenantId(tenantId);
  }
}
