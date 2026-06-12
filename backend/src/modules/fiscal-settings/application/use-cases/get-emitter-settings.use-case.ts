import type { EmitterSettingsRepository } from "../../domain/ports/emitter-settings.repository.js";

export class GetEmitterSettingsUseCase {
  constructor(private readonly emitterSettings: EmitterSettingsRepository) {}

  execute(tenantId: string) {
    return this.emitterSettings.getByTenantId(tenantId);
  }
}
