import { Module } from "@nestjs/common";
import { createTaxModule } from "./infrastructure/factory/tax-module.factory.js";
import { TaxRuleController } from "./presentation/controllers/tax-rule.controller.js";
import { TAX } from "./tax.tokens.js";

@Module({
  controllers: [TaxRuleController],
  providers: [{ provide: TAX, useFactory: createTaxModule }],
})
export class TaxModule {}
