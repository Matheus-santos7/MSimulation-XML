import type { NotaFiscalResult } from "../../../../lib/fiscal/tax-engine.js";

/**
 * Resultado agregado de cálculo inbound (espelha retorno de `calculateInboundInvoice`).
 */
export type InboundInvoiceResult = {
  nota: NotaFiscalResult;
  valor: number;
  valorIcms: number;
  aliqIcms: number;
  cfop: string;
};
