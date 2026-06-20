import type { EmitenteEmissaoOverride } from "../../../../org/index.js";
import type { Product } from "../../../../../generated/prisma/client.js";

/**
 * Options for emitting a physical shipment NF-e.
 */
export type EmitShipmentOptions = {
  unidadeDestinoId?: string;
  pedidoMl?: string;
  observacaoAvanco?: string;
  emitenteOverride?: EmitenteEmissaoOverride;
  nfeReferenciaId?: string;
};

/**
 * Input structure for a single line item in a physical shipment.
 */
export type PhysicalShipmentLineInput = {
  product: Product;
  quantidade: number;
};

/**
 * Manual shipment item input (from UI/API).
 */
export type ManualShipmentItemInput = {
  productId: string;
  productSku?: string;
  quantidade: number;
};
