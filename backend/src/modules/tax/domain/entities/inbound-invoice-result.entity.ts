import type { NotaFiscalResult } from "../../../../lib/fiscal/tax-engine.js";

export type InboundInvoiceResult = {
  nota: NotaFiscalResult;
  valor: number;
  valorIcms: number;
  aliqIcms: number;
  cfop: string;
};
