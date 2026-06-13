/** Origens ICMS com FCI — espelha `product-nfci.ts` do backend (validação de UI). */
export const PRODUCT_ORIGEM_REQUIRES_NFCI = new Set([3, 5, 8]);

const NFCI_UUID_PATTERN =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

export function requiresProductNfci(origem: number): boolean {
  return PRODUCT_ORIGEM_REQUIRES_NFCI.has(origem);
}

export function normalizeProductNfci(raw: string | undefined | null): string | undefined {
  const value = raw?.trim();
  return value ? value : undefined;
}

export function validateProductNfciForOrigem(origem: number, nfci?: string | null): string | null {
  const normalized = normalizeProductNfci(nfci ?? undefined);

  if (requiresProductNfci(origem)) {
    if (!normalized) {
      return "nFCI é obrigatório para origem 3, 5 ou 8";
    }
    if (!NFCI_UUID_PATTERN.test(normalized)) {
      return "Informe o UUID da FCI (36 caracteres com hífens)";
    }
    return null;
  }

  if (normalized) {
    return "nFCI só se aplica às origens 3, 5 e 8";
  }

  return null;
}
