/**
 * Identifica NF-e de sobra da conferência INBOUND (POSITIVE difference).
 * Usado para saldo lógico (pai + filhas) sem confundir com outras remessas referenciadas.
 */

export const ML_PROCESS_INBOUND_POSITIVE_DIFFERENCE =
  "INBOUND_POSITIVE_DIFFERENCE" as const;

export const ML_PROCESS_INBOUND_NEGATIVE_DIFFERENCE =
  "INBOUND_NEGATIVE_DIFFERENCE" as const;

export type MlInboundConferenceProcess =
  | typeof ML_PROCESS_INBOUND_POSITIVE_DIFFERENCE
  | typeof ML_PROCESS_INBOUND_NEGATIVE_DIFFERENCE;

export function mlProcessFromFiscalPayload(
  fiscalPayload: unknown,
): string | null {
  if (!fiscalPayload || typeof fiscalPayload !== "object" || Array.isArray(fiscalPayload)) {
    return null;
  }
  const raw = (fiscalPayload as Record<string, unknown>).mlProcess;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function isInboundPositiveDifferenceNfe(nfe: {
  tipo?: string | null;
  fiscalPayload?: unknown;
}): boolean {
  if (nfe.tipo != null && String(nfe.tipo) !== "REMESSA") return false;
  return mlProcessFromFiscalPayload(nfe.fiscalPayload) === ML_PROCESS_INBOUND_POSITIVE_DIFFERENCE;
}
