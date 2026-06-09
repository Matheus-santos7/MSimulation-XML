const NPROT_PATTERN = /^\d{15}$/;

export function isValidNProt(value: string): boolean {
  return NPROT_PATTERN.test(value);
}

/** nProt simulado com exatamente 15 dígitos numéricos (padrão SEFAZ). */
export function simulationNProt(seed: string | number, prefix = "135260000099"): string {
  const p = prefix.replace(/\D/g, "");
  const suffixLen = Math.max(0, 15 - p.length);
  const suffix = String(seed).replace(/\D/g, "").padStart(suffixLen, "0").slice(-suffixLen);
  return `${p.slice(0, 15 - suffixLen)}${suffix}`;
}

/** Garante 15 dígitos; corrige protocolos legados ou inválidos. */
export function ensureNProt(value: string, seed: string | number = 0): string {
  const digits = value.replace(/\D/g, "");
  if (isValidNProt(digits)) return digits;
  const prefix = digits.length >= 12 ? digits.slice(0, 12) : "135260000099";
  return simulationNProt(seed, prefix);
}

/** Protocolo SEFAZ aleatório simulado (15 dígitos). */
export function gerarProtocoloSefazSimulado(cOrgao = "41"): string {
  const org = cOrgao.replace(/\D/g, "").padStart(2, "0").slice(0, 2);
  const seq = String(Date.now() % 1_000_000_000_000).padStart(11, "0");
  return `${org}26${seq}`.slice(0, 15);
}
