import { Module } from "@nestjs/common";
import { FISCAL_SETTINGS } from "./fiscal-settings.tokens.js";
import { createFiscalSettingsModule } from "./infrastructure/factory/fiscal-settings-module.factory.js";
import { EmitterSettingsController } from "./presentation/controllers/emitter-settings.controller.js";

@Module({
  controllers: [EmitterSettingsController],
  providers: [{ provide: FISCAL_SETTINGS, useFactory: createFiscalSettingsModule }],
})
export class FiscalSettingsModule {}
