/** Origens ICMS com conteúdo de importação sujeito à FCI (`<nFCI>` na NF-e). */
export const PRODUCT_ORIGEM_REQUIRES_NFCI = new Set([3, 5, 8]);

const NFCI_UUID_PATTERN =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

export function requiresProductNfci(origem: number): boolean {
  return PRODUCT_ORIGEM_REQUIRES_NFCI.has(origem);
}

export function normalizeProductNfci(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;
  const value = String(raw).trim();
  return value.length > 0 ? value : undefined;
}

export function validateProductNfciForOrigem(origem: number, nfci?: string | null): string | null {
  const normalized = normalizeProductNfci(nfci);

  if (requiresProductNfci(origem)) {
    if (!normalized) {
      return "nFCI (Ficha de Conteúdo de Importação) é obrigatório para origem 3, 5 ou 8";
    }
    if (!NFCI_UUID_PATTERN.test(normalized)) {
      return "nFCI deve ser um UUID válido (ex.: A7B816FF-59CC-41D9-97C1-B39BCED07B17)";
    }
    return null;
  }

  if (normalized) {
    return "nFCI só se aplica às origens 3, 5 e 8 (nacional com conteúdo de importação)";
  }

  return null;
}

/** Persiste `nfci` apenas quando a origem exige FCI; caso contrário retorna `undefined`. */
export function resolveProductNfci(origem: number, nfci?: string | null): string | undefined {
  if (!requiresProductNfci(origem)) {
    return undefined;
  }
  const error = validateProductNfciForOrigem(origem, nfci);
  if (error) throw new Error(error);
  return normalizeProductNfci(nfci);
}
