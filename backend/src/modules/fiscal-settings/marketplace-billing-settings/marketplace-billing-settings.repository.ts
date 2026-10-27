import { Injectable } from "@nestjs/common";
import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";
import type { Prisma } from "../../../generated/prisma/client.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { parseMarketplaceOverrides } from "./rules/apply-marketplace-overrides.js";
import type { MarketplaceBillingOverrides } from "./marketplace-billing-settings.types.js";

/** Sobrescritas do faturador por marketplace (`marketplace_billing_settings`, com RLS). */
@Injectable()
export class MarketplaceBillingSettingsRepository {
  private get db() {
    return getDbClient();
  }

  async findOverrides(
    tenantId: string,
    marketplace: MarketplaceCode,
  ): Promise<MarketplaceBillingOverrides> {
    const row = await this.db.marketplaceBillingSettings.findUnique({
      where: { tenantId_marketplace: { tenantId, marketplace } },
    });

    return parseMarketplaceOverrides(row?.overrides);
  }

  async saveOverrides(
    tenantId: string,
    marketplace: MarketplaceCode,
    overrides: MarketplaceBillingOverrides,
  ): Promise<void> {
    const json = overrides as Prisma.InputJsonValue;
    await this.db.marketplaceBillingSettings.upsert({
      where: { tenantId_marketplace: { tenantId, marketplace } },
      create: { tenantId, marketplace, overrides: json },
      update: { overrides: json },
    });
  }
}
