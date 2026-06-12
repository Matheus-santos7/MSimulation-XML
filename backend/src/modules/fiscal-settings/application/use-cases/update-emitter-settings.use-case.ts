import type {
  EmitterSettingsRepository,
  UpdateEmitterSettingsInput,
} from "../../domain/ports/emitter-settings.repository.js";

export class UpdateEmitterSettingsUseCase {
  constructor(private readonly emitterSettings: EmitterSettingsRepository) {}

  execute(tenantId: string, input: UpdateEmitterSettingsInput) {
    return this.emitterSettings.update(tenantId, input);
  }
}
