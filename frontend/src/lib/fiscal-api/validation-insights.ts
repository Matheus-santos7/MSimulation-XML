import { buildApiUrl, getJson } from "./client";

export type ValidationInsightsDto = {
  periodDays: number;
  counts: { approved: number; rejected: number; pending: number };
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
