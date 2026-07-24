/**
 * Chaves de remessa distintas (44 dígitos), na ordem de primeira aparição.
 * Usado no retorno simbólico/físico multi-remessa → N blocos `<NFref>`.
 */
export function distinctRemessaChaves(
  lines: ReadonlyArray<{ remessaChave: string }>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const k = String(line.remessaChave ?? "").replace(/\D/g, "");
    if (k.length === 44 && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}
