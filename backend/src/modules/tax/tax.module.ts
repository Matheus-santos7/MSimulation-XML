import { Module } from "@nestjs/common";
import { TaxRuleController } from "./tax-rule/tax-rule.controller.js";
import { TaxRuleRepository } from "./tax-rule/tax-rule.repository.js";
import { TaxRuleService } from "./tax-rule/tax-rule.service.js";

/**
 * Contexto tributário.
 *
 * - `tax-rule/`: regras do tenant (rotas `/tax-rules`, importação de planilha, resolução).
 * - `tax-calculation/`: motor de cálculo de impostos (funções puras, sem rota), usado na emissão.
 *
 * Exporta o `TaxRuleService` para o catalog validar a regra vinculada ao produto.
 */
@Module({
  controllers: [TaxRuleController],
  providers: [TaxRuleRepository, TaxRuleService],
  exports: [TaxRuleService],
})
export class TaxModule {}
