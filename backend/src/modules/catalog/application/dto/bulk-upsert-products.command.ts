import type { ProductImportRawRow } from "../../domain/entities/product-import-raw-row.entity.js";

/**
 * Comando de importação em massa: linhas brutas da planilha (validação no use case).
 */
export type BulkUpsertProductsCommand = {
  tenantId: string;
  rows: ProductImportRawRow[];
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
export type BulkUpsertParseError = {
  line: number;
  message: string;
};

export type BulkUpsertProductsResult = {
  created: number;
  updated: number;
  failed: BulkUpsertFailedRow[];
  parseErrors?: BulkUpsertParseError[];
  total: number;
};
