import { Inject, Injectable } from "@nestjs/common";
import { ValidationInsightsRepository } from "../validation-insights.repository.js";

const INSIGHTS_PERIOD_DAYS = 7;
const RECENT_REJECTIONS_LIMIT = 20;
const TOP_ERRORS_LIMIT = 5;

/** Métricas da validação MCP para o painel de insights: contagens, erros frequentes, rejeições. */
@Injectable()
export class ValidationInsightsUseCase {
  constructor(
    @Inject(ValidationInsightsRepository)
    private readonly repository: ValidationInsightsRepository,
  ) {}

  async execute(tenantId: string) {
    const [counts, rejected] = await Promise.all([
      this.repository.countValidationStatuses(tenantId, INSIGHTS_PERIOD_DAYS),
      this.repository.listRecentRejectedNfes(
        tenantId,
        INSIGHTS_PERIOD_DAYS,
        RECENT_REJECTIONS_LIMIT,
      ),
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
      .slice(0, TOP_ERRORS_LIMIT)
      .map(([message, count]) => ({ message, count }));

    return {
      periodDays: INSIGHTS_PERIOD_DAYS,
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
