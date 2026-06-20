/**
 * Symbolic shipment fiscal types and interfaces.
 */
import type { ProductFiscalLine, InboundInvoiceResult } from "../../../../tax/index.js";

type ProductPrices = {
  preco: { toString(): string } | number;
  precoCusto: { toString(): string } | number;
};

export type SymbolicShipmentProduct = ProductFiscalLine &
  ProductPrices & {
    taxRuleBaseId: string | null;
  };

export type SymbolicShipmentFiscalPrepared = {
  calc: InboundInvoiceResult;
  cfop: string;
  natOp: string;
  fiscalPayload: Record<string, unknown>;
};

export type SymbolicShipmentAfterReturnInput = {
  numero: number;
  serie: number;
  emitidaEm: Date | string;
};
