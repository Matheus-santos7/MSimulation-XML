/** Keeps the last occurrence of each SKU in the batch (spreadsheets often repeat rows). */
export function dedupeBulkRowsBySku<T extends { sku: string }>(
  rows: T[],
): { row: T; line: number }[] {
  const lastLine = new Map<string, number>();
  const lastRow = new Map<string, T>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    lastLine.set(row.sku, i + 2);
    lastRow.set(row.sku, row);
  }
  return [...lastRow.entries()].map(([sku, row]) => ({
    row,
    line: lastLine.get(sku) ?? 2,
  }));
}
