import { buildApiUrl, getJson, mutateJson } from "./client";

export type ValidationInsightsDto = {
  periodDays: number;
  counts: { approved: number; rejected: number; pending: number; pendingAllTime: number };
  topErrors: { message: string; count: number }[];
  recentRejections: {
    chave: string;
    numero: number;
    serie: number;
    cfop: string;
    tipo: string;
    emitidaEm: string;
    message?: string;
    errors: string[];
  }[];
};

export type FiscalValidatorStatusDto = {
  enabled: boolean;
  apiUrl: string;
  reachable: boolean;
  message: string;
};

export async function getValidationInsights(): Promise<ValidationInsightsDto> {
  return getJson<ValidationInsightsDto>(buildApiUrl("/api/fiscal-validation/insights"));
}

export async function getFiscalValidatorStatus(): Promise<FiscalValidatorStatusDto> {
  return getJson<FiscalValidatorStatusDto>(buildApiUrl("/api/fiscal-validation/status"));
}

export type NfeValidationBackfillResult = {
  processed: number;
  approved: number;
  rejected: number;
  pending: number;
  skipped: number;
  remaining: number;
  validator: FiscalValidatorStatusDto;
  samplePendingMessage?: string;
};

export async function backfillNfeValidation(
  limit?: number,
): Promise<NfeValidationBackfillResult> {
  return mutateJson<NfeValidationBackfillResult>(
    buildApiUrl("/api/fiscal-validation/backfill"),
    "POST",
    limit ? { limit } : undefined,
  ) as Promise<NfeValidationBackfillResult>;
}
