/**
 * Módulo Fiscal Settings — configurações do emissor fiscal por tenant.
 *
 * @see ./README.md — gestão de Emitter Settings e uso na emissão
 */
import { createFiscalSettingsModule } from "./infrastructure/factory/fiscal-settings-module.factory.js";

export type { EmitterSettingsView } from "./domain/entities/emitter-settings-view.entity.js";
export type { UpdateEmitterSettingsInput } from "./domain/ports/emitter-settings.repository.js";

export { GetEmitterSettingsUseCase } from "./application/use-cases/get-emitter-settings.use-case.js";
export { UpdateEmitterSettingsUseCase } from "./application/use-cases/update-emitter-settings.use-case.js";
export { mergeEmitterSettingsPatch } from "./application/services/merge-emitter-settings-patch.service.js";

export { createFiscalSettingsModule };
export { emitterSettingsController } from "./presentation/controllers/emitter-settings.controller.js";
export { updateEmitterSettingsBodySchema } from "./presentation/schemas/emitter-settings.schemas.js";
