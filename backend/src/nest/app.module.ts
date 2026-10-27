import { Module, type DynamicModule, type Type } from "@nestjs/common";
import { AuthModule } from "../modules/auth/auth.module.js";
import { CatalogModule } from "../modules/catalog/catalog.module.js";
import { FiscalDocumentsModule } from "../modules/fiscal-documents/fiscal-documents.module.js";
import { FiscalSettingsModule } from "../modules/fiscal-settings/fiscal-settings.module.js";
import { FiscalValidationModule } from "../modules/fiscal-validation/fiscal-validation.module.js";
import { HealthModule } from "../modules/health/health.module.js";
import { LogisticsModule } from "../modules/logistics/logistics.module.js";
import { LookupModule } from "../modules/lookup/lookup.module.js";
import { MarketplaceModule } from "../modules/marketplace/marketplace.module.js";
import { OrgModule } from "../modules/org/org.module.js";
import { RemessasModule } from "../modules/remessas/remessas.module.js";
import { SalesModule } from "../modules/sales/sales.module.js";
import { TaxModule } from "../modules/tax/tax.module.js";
import { CoreModule, type CoreDependencies } from "./core.module.js";

/** Módulos de feature (um por contexto). */
const FEATURE_MODULES: Type[] = [
  HealthModule,
  LookupModule,
  FiscalSettingsModule,
  MarketplaceModule,
  TaxModule,
  CatalogModule,
  LogisticsModule,
  RemessasModule,
  OrgModule,
  FiscalValidationModule,
  FiscalDocumentsModule,
  SalesModule,
  AuthModule,
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
