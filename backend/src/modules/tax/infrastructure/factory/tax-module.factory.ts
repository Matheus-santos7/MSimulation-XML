import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { AssertProductTaxRuleBaseIdUseCase } from "../../application/use-cases/assert-product-tax-rule-base-id.use-case.js";
import { BulkUpsertTaxRulesUseCase } from "../../application/use-cases/bulk-upsert-tax-rules.use-case.js";
import { ImportTaxRulesSpreadsheetUseCase } from "../../application/use-cases/import-tax-rules-spreadsheet.use-case.js";
import { CalculateInboundTaxesUseCase } from "../../application/use-cases/calculate-inbound-taxes.use-case.js";
import { CalculateTaxesUseCase } from "../../application/use-cases/calculate-taxes.use-case.js";
import { DeleteAllTaxRulesUseCase } from "../../application/use-cases/delete-all-tax-rules.use-case.js";
import { GetTaxRuleCatalogUseCase } from "../../application/use-cases/get-tax-rule-catalog.use-case.js";
import { GetTaxRulesUseCase } from "../../application/use-cases/get-tax-rules.use-case.js";
import { ResolveTaxRuleUseCase } from "../../application/use-cases/resolve-tax-rule.use-case.js";
import { PrismaTaxRuleRepository } from "../prisma/prisma-tax-rule.repository.js";

/** Composition root for the Tax bounded context. */
export function createTaxModule(prisma: PrismaClient) {
  const taxRuleRepository = new PrismaTaxRuleRepository(prisma);

  return {
    getTaxRules: new GetTaxRulesUseCase(taxRuleRepository),
    getTaxRuleCatalog: new GetTaxRuleCatalogUseCase(taxRuleRepository),
    bulkUpsertTaxRules: new BulkUpsertTaxRulesUseCase(taxRuleRepository),
    importTaxRulesSpreadsheet: new ImportTaxRulesSpreadsheetUseCase(taxRuleRepository),
    deleteAllTaxRules: new DeleteAllTaxRulesUseCase(taxRuleRepository),
    resolveTaxRule: new ResolveTaxRuleUseCase(taxRuleRepository),
    assertProductTaxRuleBaseId: new AssertProductTaxRuleBaseIdUseCase(taxRuleRepository),
    calculateTaxes: new CalculateTaxesUseCase(),
    calculateInboundTaxes: new CalculateInboundTaxesUseCase(),
    taxRuleRepository,
  };
}
