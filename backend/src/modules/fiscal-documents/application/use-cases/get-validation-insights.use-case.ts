import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import {
  countValidationStatuses,
  listRecentRejectedNfes,
} from "../../infrastructure/prisma/prisma-validation-insights.repository.js";

/** Aggregates MCP validation metrics for IA Insights and dashboards. */
export class GetValidationInsightsUseCase {
  async execute(db: DbClient, tenantId: string) {
    const [counts, rejected] = await Promise.all([
      countValidationStatuses(db, tenantId, 7),
      listRecentRejectedNfes(db, tenantId, 7, 20),
    ]);

    const errorFrequency = new Map<string, number>();
    for (const row of rejected) {
      const errors = Array.isArray(row.errosValidacao) ? (row.errosValidacao as string[]) : [];
      for (const err of errors) {
        errorFrequency.set(err, (errorFrequency.get(err) ?? 0) + 1);
      }
    }

    const topErrors = [...errorFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    return {
      periodDays: 7,
      counts,
      topErrors,
      recentRejections: rejected.map((row) => ({
        chave: row.chave,
        numero: row.numero,
        serie: row.serie,
        cfop: row.cfop,
        tipo: row.tipo,
        emitidaEm: row.emitidaEm.toISOString(),
        message: row.mensagemValidacao ?? undefined,
        errors: Array.isArray(row.errosValidacao) ? (row.errosValidacao as string[]) : [],
      })),
    };
  }
}
