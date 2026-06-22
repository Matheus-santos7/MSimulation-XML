export type ValidationInsightRow = {
  id: string;
  chave: string;
  numero: number;
  serie: number;
  cfop: string;
  tipo: string;
  mensagemValidacao: string | null;
  errosValidacao: unknown;
  emitidaEm: Date;
};

export type ValidationStatusCounts = {
  approved: number;
  rejected: number;
  pending: number;
  pendingAllTime: number;
};

/** Reads aggregated MCP validation metrics from persistence. */
export interface ValidationInsightsRepository {
  listRecentRejectedNfes(
    tenantId: string,
    days: number,
    limit: number,
  ): Promise<ValidationInsightRow[]>;
  countValidationStatuses(tenantId: string, days: number): Promise<ValidationStatusCounts>;
}
