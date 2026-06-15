import type { PrismaClient } from "../../generated/prisma/client.js";
import type { PrismaTx } from "../../lib/db/prisma-tx.js";
import {
  buildFiscalItem,
  calculateInboundInvoice,
  calculateInvoiceTaxes,
  inferIcmsRateForShipment,
  inferIntraStateIcmsRate,
  orderLineFromProduct,
  resolveIcmsFallbackRate,
  resolveInterstateSaleFallbackRate,
  resolvePisCofinsFallbackRates,
  type InboundInvoiceResult,
} from "./application/services/tax-calculation.service.js";
import type { FiscalContext } from "./domain/entities/fiscal-context.entity.js";
import type { OrderLine } from "./domain/entities/order-line.entity.js";
import type { ProductFiscalLine } from "./domain/entities/product-fiscal-line.entity.js";
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

/** @deprecated Use InboundInvoiceResult */
export type ResultadoNotaInbound = InboundInvoiceResult;
export {
  buildFiscalItem,
  calculateInboundInvoice,
  calculateInvoiceTaxes,
  inferIcmsRateForShipment,
  inferIntraStateIcmsRate,
  normalizeProductOrigin,
  orderLineFromProduct,
  resolveIcmsFallbackRate,
  resolveInterstateIcmsFallback,
  resolveInterstateSaleFallbackRate,
  resolvePisCofinsFallbackRates,
  createTaxModule,
  resolveTaxRuleFromDb,
};
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

/** @deprecated Use orderLineFromProduct */
export const linhaPedidoFromProduto = orderLineFromProduct;

/** @deprecated Use calculateInboundInvoice */
export const calcularNotaInbound = calculateInboundInvoice;

/** @deprecated Use calculateInvoiceTaxes */
export function calcularImpostosNota(
  lines: { linha: OrderLine; rule: import("./domain/entities/resolved-tax-rule.entity.js").ResolvedTaxRule | null }[],
  ctx: FiscalContext,
  fallbackIcmsRate: number,
) {
  return calculateInvoiceTaxes(
    lines.map(({ linha, rule }) => ({ line: linha, rule })),
    ctx,
    fallbackIcmsRate,
  );
}

/** @deprecated Use buildFiscalItem */
export const montarItemFiscal = buildFiscalItem;

/** @deprecated Use inferIcmsRateForShipment */
export const inferAliqIcmsRemessa = inferIcmsRateForShipment;

/** @deprecated Use inferIntraStateIcmsRate */
export const inferAliqIcmsIntraestadual = inferIntraStateIcmsRate;

/** @deprecated Use OrderLine */
export type LinhaPedido = OrderLine;

/** @deprecated Use FiscalContext */
export type ContextoFiscal = FiscalContext;

/** @deprecated Use ProductFiscalLine */
export type ProdutoLinhaFiscal = ProductFiscalLine;
