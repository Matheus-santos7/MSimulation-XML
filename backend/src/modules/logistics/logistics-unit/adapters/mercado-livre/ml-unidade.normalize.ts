/** Normalização dos campos da planilha de CDs do Mercado Livre (export do Meli Full). */
/** Normaliza CNPJ da planilha (float, pontuação) para 14 dígitos. */
export function normalizeCnpjMeli(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.includes("e") || digits.includes("E")) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    digits = String(Math.trunc(n));
  }
  if (digits.length > 14) digits = digits.slice(-14);
  while (digits.length < 14) digits = `0${digits}`;
  if (digits.length !== 14 || /^0+$/.test(digits)) return null;
  return digits;
}

/** Extrai código da unidade (ex.: SP02, RC01) do nome da planilha. */
export function extractCodigoUnidade(nome: string): string {
  const t = nome.trim();
  const m = t.match(/^([A-Z]{2}\d{2}|RC\d{2})/i);
  if (m) return m[1]!.toUpperCase();
  const slug = t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  return slug.toUpperCase() || "UNIDADE";
}

export function normalizeCepMeli(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(0, 8);
  return digits.padStart(8, "0");
}

export function normalizeIeMeli(raw: unknown): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t || t.toLowerCase() === "none" || t === "—") return null;
  return t.replace(/\D/g, "").length > 0 ? t.replace(/\s/g, "") : t;
}

/** ID intermediador ML (`infIntermed/idCadIntTran`) — somente dígitos, até 32 chars. */
export function normalizeIdCadIntTran(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(0, 32);
}
