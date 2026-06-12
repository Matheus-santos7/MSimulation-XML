import type { OrderLine } from "../../domain/entities/order-line.entity.js";
import type { ResolvedTaxRule } from "../../domain/entities/resolved-tax-rule.entity.js";
import { calculateInboundInvoice } from "../services/tax-calculation.service.js";

export class CalculateInboundTaxesUseCase {
  execute(
    line: OrderLine,
    rule: ResolvedTaxRule,
    originUf: string,
    destinationUf: string,
    fallbackIcmsRate: number,
  ) {
    return calculateInboundInvoice(line, rule, originUf, destinationUf, fallbackIcmsRate);
  }
}
