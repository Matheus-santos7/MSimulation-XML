import type { Product } from "../../../../../generated/prisma/client.js";

/**
 * Input item for branch transfer operation.
 */
export type BranchTransferItemInput = {
  productId: string;
  productSku?: string;
  quantidade: number;
};

/**
 * Internal line representation with resolved product entity.
 */
export type BranchTransferLineInput = {
  product: Product;
  quantidade: number;
};
