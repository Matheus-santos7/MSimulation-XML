import { Module } from "@nestjs/common";
import { createSalesModule } from "./infrastructure/factory/sales-module.factory.js";
import { OrderController } from "./presentation/controllers/order.controller.js";
import { SALES } from "./sales.tokens.js";

@Module({
  controllers: [OrderController],
  providers: [{ provide: SALES, useFactory: createSalesModule }],
})
export class SalesModule {}
