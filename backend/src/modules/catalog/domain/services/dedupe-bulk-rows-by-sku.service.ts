export type BulkRowWithLine<T> = {
  row: T;
  line: number;
};

export type DedupeBulkRowsBySkuResult<T extends { sku: string }> = {
  rows: BulkRowWithLine<T>[];
  warnings: { line: number; message: string }[];
};

/**
 * Deduplica linhas de importação em massa mantendo a **última ocorrência** de cada SKU.
 *
 * Planilhas de marketplace frequentemente repetem o mesmo SKU; a linha mais abaixo
 * prevalece.
 */
export function dedupeBulkRowsBySku<T extends { sku: string }>(
  rows: BulkRowWithLine<T>[],
): DedupeBulkRowsBySkuResult<T> {
  const lastBySku = new Map<string, BulkRowWithLine<T>>();
  const warnings: { line: number; message: string }[] = [];

  for (const entry of rows) {
    const prev = lastBySku.get(entry.row.sku);
    if (prev) {
      warnings.push({
        line: prev.line,
        message: `SKU ${entry.row.sku} duplicado na planilha — mantida a linha ${entry.line}`,
      });
    }
    lastBySku.set(entry.row.sku, entry);
  }

  return {
    rows: [...lastBySku.values()],
    warnings,
  };
}
