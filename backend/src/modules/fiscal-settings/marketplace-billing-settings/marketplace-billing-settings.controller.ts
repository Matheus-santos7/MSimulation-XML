import { Body, Controller, Get, Inject, Param, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import {
  marketplaceParamsSchema,
  type MarketplaceParamsDTO,
} from "./dtos/marketplace.params.dto.js";
import {
  updateMarketplaceBillingSettingsRequestSchema,
  type UpdateMarketplaceBillingSettingsRequestDTO,
} from "./dtos/update-marketplace-billing-settings.request.dto.js";
import { MarketplaceBillingSettingsService } from "./marketplace-billing-settings.service.js";

/**
 * Configuração do faturador por marketplace (sobrescrita do padrão da empresa).
 *
 * | Método | Rota | Service |
 * |--------|------|---------|
 * | GET | `/fiscal-settings/marketplaces/:marketplace` | get (sobrescrita + efetiva) |
 * | PUT | `/fiscal-settings/marketplaces/:marketplace` | replace (ADMIN) |
 */
@Controller("fiscal-settings/marketplaces")
@ApiTags("fiscal-settings")
@ProtectedApi()
export class MarketplaceBillingSettingsController {
  constructor(
    @Inject(MarketplaceBillingSettingsService)
    private readonly billing: MarketplaceBillingSettingsService,
  ) {}

  @Get(":marketplace")
  get(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(marketplaceParamsSchema)) params: MarketplaceParamsDTO,
  ) {
    return this.billing.get(tenantId, params.marketplace);
  }

  @Put(":marketplace")
  @AdminOnly()
  replace(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(marketplaceParamsSchema)) params: MarketplaceParamsDTO,
    @Body(new ZodValidationPipe(updateMarketplaceBillingSettingsRequestSchema))
    body: UpdateMarketplaceBillingSettingsRequestDTO,
  ) {
    return this.billing.replace(tenantId, params.marketplace, body);
  }
}
