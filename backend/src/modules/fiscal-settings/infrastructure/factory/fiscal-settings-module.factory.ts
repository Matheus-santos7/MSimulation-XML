import { GetEmitterSettingsUseCase } from "../../application/use-cases/get-emitter-settings.use-case.js";
import { GetNfeNumeracaoPreviewUseCase } from "../../application/use-cases/get-nfe-numeracao-preview.use-case.js";
import { UpdateEmitterSettingsUseCase } from "../../application/use-cases/update-emitter-settings.use-case.js";
import { PrismaEmitterSettingsRepository } from "../prisma/prisma-emitter-settings.repository.js";

/**
 * Composition root do bounded context Fiscal Settings.
 *
 * @returns Use cases e repository para controller e testes
 */
export function createFiscalSettingsModule() {
  const emitterSettingsRepository = new PrismaEmitterSettingsRepository();

  return {
    getEmitterSettings: new GetEmitterSettingsUseCase(emitterSettingsRepository),
    getNfeNumeracaoPreview: new GetNfeNumeracaoPreviewUseCase(emitterSettingsRepository),
    updateEmitterSettings: new UpdateEmitterSettingsUseCase(emitterSettingsRepository),
    emitterSettingsRepository,
  };
}
