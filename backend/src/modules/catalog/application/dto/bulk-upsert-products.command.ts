import type { CreateProductCommand } from "./create-product.command.js";

export type BulkUpsertProductsCommand = {
  tenantId: string;
  rows: CreateProductCommand[];
};

export type BulkUpsertFailedRow = {
  line: number;
  sku: string;
  error: string;
};

export type BulkUpsertProductsResult = {
  created: number;
  updated: number;
  failed: BulkUpsertFailedRow[];
  total: number;
};
