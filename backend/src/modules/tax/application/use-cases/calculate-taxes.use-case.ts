import type { FiscalContext } from "../../domain/entities/fiscal-context.entity.js";
import type { OrderLine } from "../../domain/entities/order-line.entity.js";
import type { ResolvedTaxRule } from "../../domain/entities/resolved-tax-rule.entity.js";
import { calculateInvoiceTaxes } from "../services/tax-calculation.service.js";

export class CalculateTaxesUseCase {
  execute(
    lines: { line: OrderLine; rule: ResolvedTaxRule | null }[],
    ctx: FiscalContext,
    fallbackIcmsRate: number,
  ) {
    return calculateInvoiceTaxes(lines, ctx, fallbackIcmsRate);
  }
}
