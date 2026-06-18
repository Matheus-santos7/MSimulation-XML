/**
 * Formatação numérica alinhada ao schema NF-e e ao tax-engine do backend.
 * Valores monetários são strings com 2 ou 4 casas decimais fixas.
 */

/** Arredondamento comercial em 2 casas — alinhado a `roundMoney` em nfe-xml-blocks. */
export function roundMoney(value: number): number {
  return Number((value + Number.EPSILON).toFixed(2));
}

/** Formata valor monetário com 2 casas decimais (ex.: `"815.86"`). */
export function formatMoney2(value: number): string {
  return value.toFixed(2);
}

/** Formata alíquota/percentual com 4 casas decimais (ex.: `"18.0000"`). */
export function formatMoney4(value: number): string {
  return value.toFixed(4);
}

/** Extrai os 2 primeiros dígitos de um CST/CSOSN. */
export function cst2Digits(value: string): string {
  return value.slice(0, 2);
}

/** Coerce seguro para número finito. */
export function asNumeric(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
