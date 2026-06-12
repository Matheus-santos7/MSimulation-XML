import type { CustomerType } from "./tax-types.entity.js";

export type FiscalContext = {
  ufOrigem: string;
  ufDestino: string;
  customerType: CustomerType;
};
