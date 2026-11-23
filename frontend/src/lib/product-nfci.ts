/** Origens ICMS com FCI — espelha `product-nfci.ts` do backend (validação de UI). */
export const PRODUCT_ORIGEM_REQUIRES_NFCI = new Set([3, 5, 8]);

export function requiresProductNfci(origem: number): boolean {
  return PRODUCT_ORIGEM_REQUIRES_NFCI.has(origem);
}

export function normalizeProductNfci(raw: string | undefined | null): string | undefined {
  const value = raw?.trim();
  return value ? value : undefined;
}
