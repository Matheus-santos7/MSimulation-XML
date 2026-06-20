import type { PrismaTx } from "../../lib/db/prisma-tx.js";
import { TaxRuleCatalogError, TaxRuleError } from "./domain/errors/tax-rule.error.js";
import type { ResolveTaxRuleParams } from "./domain/ports/tax-rule.repository.js";
import { createTaxModule } from "./infrastructure/factory/tax-module.factory.js";
import { resolveTaxRuleFromDb } from "./infrastructure/prisma/tax-rule-resolution.js";

export { TaxRuleError, TaxRuleCatalogError };
export type { CustomerType, TransactionType } from "./domain/entities/tax-types.entity.js";
export type { TaxRule } from "./domain/entities/tax-rule.entity.js";
export type { ResolvedTaxRule } from "./domain/entities/resolved-tax-rule.entity.js";
export type { TaxRuleCatalogEntry } from "./domain/entities/tax-rule-catalog-entry.entity.js";
export type { TaxRuleImportRow } from "./domain/entities/tax-rule-import-row.entity.js";
export type { OrderLine, FiscalContext, ProductFiscalLine, ResolveTaxRuleParams };
export type { InboundInvoiceResult };

export {
  buildFiscalItem,
  calculateInboundInvoice,
  calculateInvoiceTaxes,
  orderLineFromProduct,
} from "./application/services/tax-calculation.service.js";

export {
  inferIcmsRateForShipment,
  inferIntraStateIcmsRate,
  normalizeProductOrigin,
  resolveIcmsFallbackRate,
  resolveInterstateIcmsFallback,
  resolveInterstateSaleFallbackRate,
  resolvePisCofinsFallbackRates,
} from "./application/services/tax-fallback-resolver.service.js";

export { createTaxModule, resolveTaxRuleFromDb };
export { taxRuleController } from "./presentation/controllers/tax-rule.controller.js";
export {
  taxRuleImportRowSchema,
  taxRulesBulkBodySchema,
} from "./presentation/schemas/tax.schemas.js";

export async function resolveTaxRule(
  prisma: PrismaTx,
  tenantId: string,
  params: ResolveTaxRuleParams,
) {
  return resolveTaxRuleFromDb(prisma, tenantId, params);
}

export async function listTaxRuleCatalog(tenantId: string) {
  return createTaxModule().getTaxRuleCatalog.execute(tenantId);
}

export async function assertProductTaxRuleBaseId(
  tenantId: string,
  taxRuleBaseId: string,
  tenantUf?: string,
) {
  return createTaxModule().assertProductTaxRuleBaseId.execute(
    tenantId,
    taxRuleBaseId,
    tenantUf,
  );
}

export async function deleteAllTaxRules(tenantId: string) {
  return createTaxModule().deleteAllTaxRules.execute(tenantId);
}
