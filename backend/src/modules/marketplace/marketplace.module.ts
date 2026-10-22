import { Module } from "@nestjs/common";
import { MarketplaceController } from "./marketplace.controller.js";
import { MarketplaceService } from "./marketplace.service.js";

/**
 * Marketplaces atendidos. As regras fiscais de cada um ficam em
 * `packages/fiscal-core/src/marketplaces/<marketplace>/`; a configuração do faturador por
 * marketplace fica no fiscal-settings.
 */
@Module({
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
})
export class MarketplaceModule {}
