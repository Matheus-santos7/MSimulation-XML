/**
 * Deduplica linhas de importação em massa mantendo a **última ocorrência** de cada SKU.
 *
 * Planilhas de marketplace frequentemente repetem o mesmo SKU; a linha mais abaixo
 * prevalece. O número de linha reportado em erros considera cabeçalho (linha 1 = header,
 * primeira linha de dados = 2).
 *
 * @param rows - Linhas do payload bulk (cada uma com `sku`)
 * @returns Pares `{ row, line }` únicos por SKU, com `line` para mensagens de erro
 */
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
