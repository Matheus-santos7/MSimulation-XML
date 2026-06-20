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

export async function getValidationInsights(): Promise<ValidationInsightsDto> {
  return getJson<ValidationInsightsDto>(buildApiUrl("/api/fiscal-validation/insights"));
}

export type NfeValidationBackfillResult = {
  processed: number;
  approved: number;
  rejected: number;
  pending: number;
  skipped: number;
  remaining: number;
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
