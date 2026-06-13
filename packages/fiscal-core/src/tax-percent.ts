/**
 * Normaliza percentuais vindos da planilha ML (ex.: 260 → 2,6% | 165 → 1,65%).
 * Alinhado à exibição em `frontend/src/app/(app)/regras/page.tsx`.
 */
export function normalizeTaxPercent(value: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  if (value < 10) return value;
  if (value >= 100) return value / 100;
  if (Number.isInteger(value) && String(Math.round(value)).length >= 3) return value / 100;
  return value;
}

export function parseTaxPercent(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeTaxPercent(value);
  }
  if (value == null) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return fallback;
  return normalizeTaxPercent(n);
}
