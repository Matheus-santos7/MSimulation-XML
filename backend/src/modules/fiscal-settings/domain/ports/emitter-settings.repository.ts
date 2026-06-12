import type { EmitterSettingsView } from "../entities/emitter-settings-view.entity.js";

export interface UpdateEmitterSettingsInput {
  basic?: Record<string, unknown>;
  taxes?: Record<string, unknown>;
  nfe?: Record<string, unknown>;
  serieRemessa?: number;
  serieCte?: number;
}

export interface EmitterSettingsRepository {
  getByTenantId(tenantId: string): Promise<EmitterSettingsView | null>;
  update(tenantId: string, input: UpdateEmitterSettingsInput): Promise<EmitterSettingsView | null>;
}
