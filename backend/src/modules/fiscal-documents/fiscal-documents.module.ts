import { Module } from "@nestjs/common";
import { FISCAL_DOCUMENTS } from "./fiscal-documents.tokens.js";
import { createFiscalDocumentsModule } from "./infrastructure/factory/fiscal-documents-module.factory.js";
import { CteController } from "./presentation/controllers/cte.controller.js";
import { FiscalObservabilityController } from "./presentation/controllers/fiscal-observability.controller.js";
import { NfeLifecycleController } from "./presentation/controllers/nfe-lifecycle.controller.js";
import { NfeController } from "./presentation/controllers/nfe.controller.js";

@Module({
  controllers: [
    NfeLifecycleController,
    NfeController,
    CteController,
    FiscalObservabilityController,
  ],
  providers: [{ provide: FISCAL_DOCUMENTS, useFactory: createFiscalDocumentsModule }],
})
export class FiscalDocumentsModule {}
