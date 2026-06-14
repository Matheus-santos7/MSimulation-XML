/**
 * Módulo Fiscal Settings — configurações do emissor fiscal por tenant.
 *
 * @see ./README.md — gestão de Emitter Settings e uso na emissão
 */
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { DbClient } from "../../lib/db/prisma-tx.js";
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

/**
 * Fachada legada para código que ainda instancia serviço direto com Prisma.
 * @deprecated Use `createFiscalSettingsModule` e os use cases
 */
export class FiscalEmitterSettingsService {
  constructor(private readonly prisma: DbClient) {}

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
