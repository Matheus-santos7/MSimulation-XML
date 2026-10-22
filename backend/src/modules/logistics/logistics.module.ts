import { Module } from "@nestjs/common";
import { LookupModule } from "../lookup/lookup.module.js";
import { RemessasModule } from "../remessas/remessas.module.js";
import { LogisticsUnitController } from "./logistics-unit/logistics-unit.controller.js";
import { LogisticsUnitRepository } from "./logistics-unit/logistics-unit.repository.js";
import { LogisticsUnitService } from "./logistics-unit/logistics-unit.service.js";
import { AdvanceProductResolver } from "./product-movement/advance-product.resolver.js";
import { MovementController } from "./product-movement/movement.controller.js";
import { ProductMovementRepository } from "./product-movement/product-movement.repository.js";
import { ProductMovementService } from "./product-movement/product-movement.service.js";

/**
 * Logística.
 *
 * | Pasta | Rotas |
 * |-------|-------|
 * | `logistics-unit/` | /unidades-logisticas (CDs por marketplace) |
 * | `product-movement/` | /movimentacoes-produto e as rotas de emissão em /movimentacoes/* |
 *
 * `logistics-unit/adapters/mercado-livre/` lê a planilha de CDs do Mercado Livre; outro
 * marketplace entra com o próprio adapter.
 */
@Module({
  imports: [LookupModule, RemessasModule],
  controllers: [LogisticsUnitController, MovementController],
  providers: [
    LogisticsUnitRepository,
    LogisticsUnitService,
    ProductMovementRepository,
    AdvanceProductResolver,
    ProductMovementService,
  ],
  exports: [LogisticsUnitService, ProductMovementService],
})
export class LogisticsModule {}
