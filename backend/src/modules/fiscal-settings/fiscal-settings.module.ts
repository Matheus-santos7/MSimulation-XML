import { Module } from "@nestjs/common";
import { EmitterSettingsController } from "./emitter-settings/emitter-settings.controller.js";
import { EmitterSettingsRepository } from "./emitter-settings/emitter-settings.repository.js";
import { EmitterSettingsService } from "./emitter-settings/emitter-settings.service.js";
import { MarketplaceBillingSettingsController } from "./marketplace-billing-settings/marketplace-billing-settings.controller.js";
import { MarketplaceBillingSettingsRepository } from "./marketplace-billing-settings/marketplace-billing-settings.repository.js";
import { MarketplaceBillingSettingsService } from "./marketplace-billing-settings/marketplace-billing-settings.service.js";

/**
 * Configuração do faturador.
 *
 * | Pasta | Rotas |
 * |-------|-------|
 * | `emitter-settings/` | /fiscal-settings, /fiscal-settings/nfe-numeracao (padrão da empresa) |
 * | `marketplace-billing-settings/` | /fiscal-settings/marketplaces/:marketplace (sobrescrita) |
 *
 * `billing-settings/` é o que a emissão usa: `loadEmitterSettings(db, tenantId, marketplace)`.
 * Exporta o `MarketplaceBillingSettingsService` para o módulo marketplace.
 */
@Module({
  controllers: [EmitterSettingsController, MarketplaceBillingSettingsController],
  providers: [
    EmitterSettingsRepository,
    EmitterSettingsService,
    MarketplaceBillingSettingsRepository,
    MarketplaceBillingSettingsService,
  ],
  exports: [MarketplaceBillingSettingsService],
})
export class FiscalSettingsModule {}
