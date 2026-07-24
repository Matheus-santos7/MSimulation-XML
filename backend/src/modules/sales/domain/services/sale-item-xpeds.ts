/**
 * Resolve `xPed` por `nItem` na venda: orderId do item ou packId do pedido.
 */
export function resolveSaleItemXPeds(
  items: ReadonlyArray<{ xPed?: string | null }>,
  packXPed: string,
): string[] {
  const pack = packXPed.trim();
  return items.map((item) => {
    const own = item.xPed?.trim();
    return own && own.length > 0 ? own : pack;
  });
}
