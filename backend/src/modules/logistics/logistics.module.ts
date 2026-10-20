import { Module } from "@nestjs/common";
import { RemessasModule } from "../remessas/remessas.module.js";
import { createLogisticsModule } from "./infrastructure/factory/logistics-module.factory.js";
import { LOGISTICS } from "./logistics.tokens.js";
import { LogisticsUnitController } from "./presentation/controllers/logistics-unit.controller.js";
import { MovementController } from "./presentation/controllers/movement.controller.js";

@Module({
  imports: [RemessasModule],
  controllers: [LogisticsUnitController, MovementController],
  providers: [{ provide: LOGISTICS, useFactory: createLogisticsModule }],
})
export class LogisticsModule {}
