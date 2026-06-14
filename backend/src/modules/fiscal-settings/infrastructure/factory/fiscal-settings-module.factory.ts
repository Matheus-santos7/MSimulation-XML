import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { GetEmitterSettingsUseCase } from "../../application/use-cases/get-emitter-settings.use-case.js";
import { UpdateEmitterSettingsUseCase } from "../../application/use-cases/update-emitter-settings.use-case.js";
import { PrismaEmitterSettingsRepository } from "../prisma/prisma-emitter-settings.repository.js";

/**
 * Composition root do bounded context Fiscal Settings.
 *
 * @param prisma - Cliente Prisma da aplicação
 * @returns Use cases e repository para controller e testes
 */
export function createFiscalSettingsModule(db: DbClient) {
  const emitterSettingsRepository = new PrismaEmitterSettingsRepository(db);

  return {
    getEmitterSettings: new GetEmitterSettingsUseCase(emitterSettingsRepository),
    updateEmitterSettings: new UpdateEmitterSettingsUseCase(emitterSettingsRepository),
    emitterSettingsRepository,
  };
}
