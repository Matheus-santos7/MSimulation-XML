/**
 * Regimes especiais EBazar (UF + CNPJ da filial) para sufixo de `<infCpl>`.
 * Spec: docs/specs/infcpl-fulfillment-ebazar.md
 */

export type EbazarRegimeEspecialEntry = {
  uf: string;
  cnpj: string;
  text: string;
};

/** Pares canônicos — CNPJ sempre em dígitos; textos ASCII. */
export const EBAZAR_REGIME_ESPECIAL_BY_UF_CNPJ: readonly EbazarRegimeEspecialEntry[] = [
  {
    uf: "BA",
    cnpj: "03007331009793",
    text: "Regime Especial BA - Parecer DITRI/GETRI n 3828/2022.",
  },
  {
    uf: "SC",
    cnpj: "03007331012077",
    text: "Regime Especial SC - TTD SC n 225000004034256.",
  },
  {
    uf: "RJ",
    cnpj: "03007331010295",
    text: "Regime Especial RJ - Parecer n 176/2022/SEFAZ/COOCJT.",
  },
  {
    uf: "MG",
    cnpj: "03007331013715",
    text: "Regime Especial MG - E-PTA-RE n 45.000038282-71.",
  },
  {
    uf: "DF",
    cnpj: "03007331004643",
    text: "Regime Especial DF - Ato Declaratorio n 2/2024.",
  },
  {
    uf: "RS",
    cnpj: "03007331019160",
    text: "Regime Especial RS - Ato Declaratorio n 2023/107.",
  },
  {
    uf: "PR",
    cnpj: "03007331001628",
    text: "Regime Especial PR - Regime Especial n 7975/2022.",
  },
  {
    uf: "PE",
    cnpj: "03007331018350",
    text: "Regime Especial PE - Edital DPC n 077/2024.",
  },
] as const;

export function normalizeCnpjDigits(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export function normalizeUf(uf: string): string {
  return uf.trim().toUpperCase();
}

/** Match exato UF + CNPJ (dígitos). Null se não houver par. */
export function resolveRegimeEspecial(ufDestino: string, cnpjFilial: string): string | null {
  const uf = normalizeUf(ufDestino);
  const cnpj = normalizeCnpjDigits(cnpjFilial);
  if (!uf || !cnpj) return null;
  const hit = EBAZAR_REGIME_ESPECIAL_BY_UF_CNPJ.find((e) => e.uf === uf && e.cnpj === cnpj);
  return hit?.text ?? null;
}
