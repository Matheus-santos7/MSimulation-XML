import { Module, type DynamicModule, type Type } from "@nestjs/common";
import { FiscalSettingsModule } from "../modules/fiscal-settings/fiscal-settings.module.js";
import { HealthModule } from "../modules/health/health.module.js";
import { LookupModule } from "../modules/lookup/lookup.module.js";
import { TaxModule } from "../modules/tax/tax.module.js";
import { CoreModule, type CoreDependencies } from "./core.module.js";

/** Módulos de feature já migrados para o Nest (cada fase acrescenta um). */
const FEATURE_MODULES: Type[] = [HealthModule, LookupModule, FiscalSettingsModule, TaxModule];

@Module({})
export class AppModule {
  static register(dependencies: CoreDependencies): DynamicModule {
    return {
      module: AppModule,
      imports: [CoreModule.register(dependencies), ...FEATURE_MODULES],
    };
  }
}
