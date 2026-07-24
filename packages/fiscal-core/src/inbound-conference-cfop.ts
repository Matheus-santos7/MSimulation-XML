/**
 * CFOP allowlists — conferência INBOUND POSITIVE / NEGATIVE (planilha ML).
 */

export const ML_INBOUND_POSITIVE_DIFFERENCE_CFOPS = [
  "6409",
  "5949",
  "6949",
  "6152",
  "6904",
  "6151",
  "5152",
  "5904",
] as const;

export const ML_INBOUND_NEGATIVE_DIFFERENCE_CFOPS = [
  "1904",
  "2949",
  "2904",
  "1949",
] as const;

export type MlInboundPositiveDifferenceCfop =
  (typeof ML_INBOUND_POSITIVE_DIFFERENCE_CFOPS)[number];
export type MlInboundNegativeDifferenceCfop =
  (typeof ML_INBOUND_NEGATIVE_DIFFERENCE_CFOPS)[number];

export class InboundConferenceCfopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InboundConferenceCfopError";
  }
}

function normalizeUf(uf: string): string {
  return uf.trim().toUpperCase();
}

export function isMlInboundPositiveDifferenceCfop(
  cfop: string,
): cfop is MlInboundPositiveDifferenceCfop {
  return (ML_INBOUND_POSITIVE_DIFFERENCE_CFOPS as readonly string[]).includes(cfop.trim());
}

export function isMlInboundNegativeDifferenceCfop(
  cfop: string,
): cfop is MlInboundNegativeDifferenceCfop {
  return (ML_INBOUND_NEGATIVE_DIFFERENCE_CFOPS as readonly string[]).includes(cfop.trim());
}

export function assertMlInboundPositiveDifferenceCfop(
  cfop: string,
): MlInboundPositiveDifferenceCfop {
  const c = cfop.trim();
  if (!isMlInboundPositiveDifferenceCfop(c)) {
    throw new InboundConferenceCfopError(
      `CFOP ${c} fora da allowlist INBOUND_POSITIVE_DIFFERENCE (${ML_INBOUND_POSITIVE_DIFFERENCE_CFOPS.join(", ")})`,
    );
  }
  return c;
}

export function assertMlInboundNegativeDifferenceCfop(
  cfop: string,
): MlInboundNegativeDifferenceCfop {
  const c = cfop.trim();
  if (!isMlInboundNegativeDifferenceCfop(c)) {
    throw new InboundConferenceCfopError(
      `CFOP ${c} fora da allowlist INBOUND_NEGATIVE_DIFFERENCE (${ML_INBOUND_NEGATIVE_DIFFERENCE_CFOPS.join(", ")})`,
    );
  }
  return c;
}

/**
 * Default POSITIVE: 5949 intra / 6949 inter (mesma remessa física atual).
 * Override opcional validado na allowlist completa.
 */
export function resolveInboundPositiveDifferenceCfop(
  emitUf: string,
  destUf: string,
  overrideCfop?: string | null,
): MlInboundPositiveDifferenceCfop {
  if (overrideCfop?.trim()) {
    return assertMlInboundPositiveDifferenceCfop(overrideCfop);
  }
  const intra = normalizeUf(emitUf) === normalizeUf(destUf);
  return intra ? "5949" : "6949";
}

/**
 * Default NEGATIVE: 1949 intra / 2949 inter (retorno físico atual).
 * Override opcional validado na allowlist.
 */
export function resolveInboundNegativeDifferenceCfop(
  emitUf: string,
  destUf: string,
  overrideCfop?: string | null,
): MlInboundNegativeDifferenceCfop {
  if (overrideCfop?.trim()) {
    return assertMlInboundNegativeDifferenceCfop(overrideCfop);
  }
  const intra = normalizeUf(emitUf) === normalizeUf(destUf);
  return intra ? "1949" : "2949";
}

export const INBOUND_POSITIVE_DIFFERENCE_NAT_OP =
  "Outras Saidas - Remessa para Deposito Temporario";

export const INBOUND_NEGATIVE_DIFFERENCE_NAT_OP =
  "Outras Entradas - Retorno de Deposito Temporario";
