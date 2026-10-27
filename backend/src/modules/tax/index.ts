/**
 * API pública do contexto tributário para outros módulos. Ninguém importa caminhos internos de
 * `tax/`: o que remessas, sales, fiscal-documents e catalog usam sai daqui. Não reexporta o
 * `TaxModule` (o `app.module.ts` importa pelo caminho dele).
 */
import type { PrismaTx } from "../../lib/db/prisma-tx.js";
import { resolveTaxRuleFromDb } from "./tax-rule/tax-rule-resolution.js";
import type { ResolveTaxRuleParams } from "./tax-rule/types/tax-rule-query.types.js";

export { TaxRuleCatalogError, TaxRuleError } from "./errors/tax.errors.js";

// tax-calculation: motor de cálculo
export {
  buildFiscalItem,
  calculateInboundInvoice,
  calculateInvoiceTaxes,
  orderLineFromProduct,
} from "./tax-calculation/tax-calculation.js";
export {
  calcularNotaFiscal,
  type ItemFiscalResult,
  type NotaFiscalResult,
} from "./tax-calculation/tax-engine.js";
export { taxSnapshotFromRule } from "./tax-calculation/tax-snapshot.js";
export {
  isInterstateByCfopOrUf,
  resolveFcpPlacement,
  type FcpPlacement,
  type FcpPlacementInput,
} from "./tax-calculation/fcp-placement.js";
export { applyCstDevolucaoMap } from "./tax-calculation/apply-cst-devolucao-map.js";
export {
  mirrorOriginForDevolucao,
  parseOriginEngine,
  type DevolucaoItemPedido,
  type ImpostoDevolItem,
  type MirrorOriginForDevolucaoInput,
} from "./tax-calculation/mirror-origin-for-devolucao.js";
export {
  inferIcmsRateForShipment,
  inferIntraStateIcmsRate,
  normalizeProductOrigin,
  resolveIcmsFallbackRate,
  resolveInterstateIcmsFallback,
  resolveInterstateSaleFallbackRate,
  resolvePisCofinsFallbackRates,
} from "./tax-calculation/tax-fallback-resolver.js";
export type { FiscalContext } from "./tax-calculation/types/fiscal-context.types.js";
export type { InboundInvoiceResult } from "./tax-calculation/types/inbound-invoice-result.types.js";
export type { OrderLine } from "./tax-calculation/types/order-line.types.js";
export type { ProductFiscalLine } from "./tax-calculation/types/product-fiscal-line.types.js";
export type { CustomerType, TransactionType } from "./tax-calculation/types/tax-types.types.js";

// tax-rule: regras do tenant
export {
  resolveTaxRuleRefFromCatalog,
  type ResolveTaxRuleRefResult,
} from "./tax-rule/rules/resolve-tax-rule-ref-from-catalog.js";
export { TaxRuleService } from "./tax-rule/tax-rule.service.js";
export type { ResolvedTaxRule } from "./tax-rule/types/resolved-tax-rule.types.js";
export type { TaxRuleCatalogEntry } from "./tax-rule/types/tax-rule-catalog-entry.types.js";
export type { TaxRuleImportRow } from "./tax-rule/types/tax-rule-import-row.types.js";
export type { ResolveTaxRuleParams } from "./tax-rule/types/tax-rule-query.types.js";
export type { TaxRule } from "./tax-rule/types/tax-rule.types.js";

/** Resolve a regra fiscal (origem × destino × operação) dentro da transação da emissão. */
export async function resolveTaxRule(
  prisma: PrismaTx,
  tenantId: string,
  params: ResolveTaxRuleParams,
) {
  return resolveTaxRuleFromDb(prisma, tenantId, params);
}
