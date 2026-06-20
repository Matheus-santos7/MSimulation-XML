/**
 * Utilitários compartilhados pelos node builders de CT-e.
 *
 * @module cte-xml/cte-xml.util
 */

const UF_IBGE: Record<string, number> = {
  AC: 12, AL: 27, AM: 13, AP: 16, BA: 29, CE: 23, DF: 53, ES: 32, GO: 52,
  MA: 21, MG: 31, MS: 50, MT: 51, PA: 15, PB: 25, PE: 26, PI: 22, PR: 41,
  RJ: 33, RN: 24, RO: 11, RR: 14, RS: 43, SC: 42, SE: 28, SP: 35, TO: 17,
};

/** Converte UF em código IBGE (fallback SP). */
export function ufToCodigo(uf: string): number {
  return UF_IBGE[uf.toUpperCase()] ?? 35;
}

/** Remove caracteres não numéricos. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formata valor monetário com 2 casas decimais. */
export function formatMoney2(value: number): string {
  return value.toFixed(2);
}

/** Formata peso/quantidade com 4 casas decimais. */
export function formatWeight4(value: number): string {
  return value.toFixed(4);
}

/** Resolve tag CPF/CNPJ e valor normalizado do participante. */
export function resolveParticipanteDoc(doc: string): { tag: "CPF" | "CNPJ"; value: string } {
  const digits = digitsOnly(doc);
  if (digits.length === 11) return { tag: "CPF", value: digits };
  return { tag: "CNPJ", value: digits.padStart(14, "0").slice(-14) };
}
