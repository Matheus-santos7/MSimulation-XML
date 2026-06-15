/** Alíquota interestadual para mercadoria importada (Resolução do Senado Federal 13/2012). */
export const SENATE_RESOLUTION_IMPORT_INTERSTATE_RATE = 4;

/** Origens com conteúdo importado sujeitas à alíquota de 4% em operações interestaduais. */
export const IMPORTED_ICMS_ORIGINS = new Set([1, 2, 3, 8]);

/**
 * Indica se a origem da mercadoria exige alíquota interestadual reduzida (4%).
 * Aplica-se às origens 1, 2, 3 e 8 conforme Resolução do Senado 13/2012.
 */
export function isImportedInterstateOrigin(orig: number): boolean {
  return IMPORTED_ICMS_ORIGINS.has(orig);
}

/**
 * Ajusta a alíquota interestadual do ICMS próprio quando a mercadoria é importada.
 * Em operação interestadual, força 4% para origens 1, 2, 3 ou 8.
 */
export function resolveInterstateIcmsRateForProductOrigin(
  productOrigin: number,
  isInterstate: boolean,
  baseRate: number,
): number {
  if (!isInterstate) return baseRate;
  if (!isImportedInterstateOrigin(productOrigin)) return baseRate;
  return SENATE_RESOLUTION_IMPORT_INTERSTATE_RATE;
}

/** UF efetiva de saída física da mercadoria (CD) ou, na ausência, UF do emitente. */
export function resolveFiscalExitUf(emitUf: string, stockUf?: string | null): string {
  const stock = stockUf?.trim().toUpperCase();
  if (stock && stock.length === 2) return stock;
  return emitUf.trim().toUpperCase();
}
