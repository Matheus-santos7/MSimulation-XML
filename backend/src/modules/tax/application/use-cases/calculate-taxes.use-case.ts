import type { FiscalContext } from "../../domain/entities/fiscal-context.entity.js";
import type { OrderLine } from "../../domain/entities/order-line.entity.js";
import type { ResolvedTaxRule } from "../../domain/entities/resolved-tax-rule.entity.js";
import { calculateInvoiceTaxes } from "../services/tax-calculation.service.js";

/**
 * Caso de uso fino: calcula impostos de nota de venda (múltiplos itens).
 *
 * @param lines - Itens com regra resolvida por linha
 * @param ctx - UF origem/destino e tipo de cliente
 * @param fallbackIcmsRate - Alíquota ICMS de reserva
 * @returns {@link NotaFiscalResult} do tax-engine
 */
export class CalculateTaxesUseCase {
  execute(
    lines: { line: OrderLine; rule: ResolvedTaxRule | null }[],
    ctx: FiscalContext,
    fallbackIcmsRate: number,
  ) {
    return calculateInvoiceTaxes(lines, ctx, fallbackIcmsRate);
  }
}
