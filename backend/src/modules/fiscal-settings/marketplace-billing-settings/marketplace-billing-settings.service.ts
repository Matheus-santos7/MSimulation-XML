import { Inject, Injectable } from "@nestjs/common";
import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";
import { EmitterSettingsService } from "../emitter-settings/emitter-settings.service.js";
import { MarketplaceBillingSettingsRepository } from "./marketplace-billing-settings.repository.js";
import type {
  MarketplaceBillingOverrides,
  MarketplaceBillingSettingsView,
} from "./marketplace-billing-settings.types.js";
import { applyMarketplaceOverrides } from "./rules/apply-marketplace-overrides.js";

/**
 * Configuração do faturador por marketplace: padrão da empresa + o que o marketplace muda.
 * A emissão usa a mesma regra (`loadEmitterSettings` com marketplace).
 */
@Injectable()
export class MarketplaceBillingSettingsService {
  constructor(
    @Inject(MarketplaceBillingSettingsRepository)
    private readonly repository: MarketplaceBillingSettingsRepository,
    @Inject(EmitterSettingsService) private readonly emitterSettings: EmitterSettingsService,
  ) {}

  async get(
    tenantId: string,
    marketplace: MarketplaceCode,
  ): Promise<MarketplaceBillingSettingsView> {
    const [defaults, overrides] = await Promise.all([
      this.emitterSettings.get(tenantId),
      this.repository.findOverrides(tenantId, marketplace),
    ]);

    return {
      marketplace,
      overrides,
      effective: applyMarketplaceOverrides(defaults.settings, overrides),
    };
  }

  /** Substitui a sobrescrita; o merge é validado antes de gravar (seções inválidas falham aqui). */
  async replace(
    tenantId: string,
    marketplace: MarketplaceCode,
    overrides: MarketplaceBillingOverrides,
  ): Promise<MarketplaceBillingSettingsView> {
    const defaults = await this.emitterSettings.get(tenantId);
    const effective = applyMarketplaceOverrides(defaults.settings, overrides);
    await this.repository.saveOverrides(tenantId, marketplace, overrides);

    return { marketplace, overrides, effective };
  }
}
