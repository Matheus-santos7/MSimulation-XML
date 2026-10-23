/**
 * Resolve lista de chaves referenciadas para UI/API (retorno multi-remessa).
 * Preferência: chaves distintas dos consumos FIFO; senão a FK principal.
 */
export function resolveNfeReferenciaChaves(input: {
  primaryChave?: string | null;
  consumoChaves?: ReadonlyArray<string | null | undefined>;
}): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.consumoChaves ?? []) {
    const k = String(raw ?? "").replace(/\D/g, "");
    if (k.length === 44 && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  if (out.length > 0) return out;

  const primary = String(input.primaryChave ?? "").replace(/\D/g, "");
  return primary.length === 44 ? [primary] : [];
}
