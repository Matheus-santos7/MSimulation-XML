import { Module, type DynamicModule, type Type } from "@nestjs/common";
import { CatalogModule } from "../modules/catalog/catalog.module.js";
import { FiscalSettingsModule } from "../modules/fiscal-settings/fiscal-settings.module.js";
import { HealthModule } from "../modules/health/health.module.js";
import { LogisticsModule } from "../modules/logistics/logistics.module.js";
import { LookupModule } from "../modules/lookup/lookup.module.js";
import { OrgModule } from "../modules/org/org.module.js";
import { TaxModule } from "../modules/tax/tax.module.js";
import { CoreModule, type CoreDependencies } from "./core.module.js";

/** Módulos de feature já migrados para o Nest (cada fase acrescenta um). */
const FEATURE_MODULES: Type[] = [
  HealthModule,
  LookupModule,
  FiscalSettingsModule,
  TaxModule,
  CatalogModule,
  LogisticsModule,
  OrgModule,
];

@Module({})
export class AppModule {
  static register(dependencies: CoreDependencies): DynamicModule {
    return {
      module: AppModule,
      imports: [CoreModule.register(dependencies), ...FEATURE_MODULES],
    };
  }
}
