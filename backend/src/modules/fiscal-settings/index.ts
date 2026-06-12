import type { PrismaClient } from "../../generated/prisma/client.js";
import type { UpdateEmitterSettingsInput } from "./domain/ports/emitter-settings.repository.js";
import { createFiscalSettingsModule } from "./infrastructure/factory/fiscal-settings-module.factory.js";

export type { EmitterSettingsView, FiscalEmitterSettingsView } from "./domain/entities/emitter-settings-view.entity.js";
export type { UpdateEmitterSettingsInput } from "./domain/ports/emitter-settings.repository.js";

export { GetEmitterSettingsUseCase } from "./application/use-cases/get-emitter-settings.use-case.js";
export { UpdateEmitterSettingsUseCase } from "./application/use-cases/update-emitter-settings.use-case.js";
export { mergeEmitterSettingsPatch } from "./application/services/merge-emitter-settings-patch.service.js";

export { createFiscalSettingsModule };
export {
  emitterSettingsController,
  fiscalSettingsRoutes,
} from "./presentation/controllers/emitter-settings.controller.js";
export {
  updateEmitterSettingsBodySchema,
  fiscalEmitterSettingsPatchBody,
} from "./presentation/schemas/emitter-settings.schemas.js";

/** @deprecated Use createFiscalSettingsModule and GetEmitterSettingsUseCase */
export class FiscalEmitterSettingsService {
  constructor(private readonly prisma: PrismaClient) {}

  private get module() {
    return createFiscalSettingsModule(this.prisma);
  }

  getView(tenantId: string) {
    return this.module.getEmitterSettings.execute(tenantId);
  }

  patch(tenantId: string, body: UpdateEmitterSettingsInput) {
    return this.module.updateEmitterSettings.execute(tenantId, body);
  }
}
