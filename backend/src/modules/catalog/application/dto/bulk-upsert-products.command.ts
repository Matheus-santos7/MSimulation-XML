import type { CreateProductCommand } from "./create-product.command.js";

/**
 * Comando de importação em massa: lista de produtos para create ou update por SKU.
 */
export type BulkUpsertProductsCommand = {
  tenantId: string;
  rows: CreateProductCommand[];
};

/** Linha que falhou no bulk upsert (processamento continua nas demais). */
export type BulkUpsertFailedRow = {
  /** Número da linha na planilha (1-based com offset de cabeçalho). */
  line: number;
  sku: string;
  error: string;
};

/**
 * Resultado agregado do bulk upsert.
 * `total` reflete linhas após deduplicação por SKU, não o tamanho bruto do array.
 */
export type BulkUpsertProductsResult = {
  created: number;
  updated: number;
  failed: BulkUpsertFailedRow[];
  total: number;
};
