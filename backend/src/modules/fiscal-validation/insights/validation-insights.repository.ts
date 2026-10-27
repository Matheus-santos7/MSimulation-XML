import { NfeValidationStatus } from "../../../generated/prisma/client.js";
import { Injectable } from "@nestjs/common";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import type { ValidationInsightRow, ValidationStatusCounts } from "./validation-insights.types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Métricas de validação MCP das NF-es do tenant. */
@Injectable()
export class ValidationInsightsRepository {
  private get db() {
    return getDbClient();
  }

  async listRecentRejectedNfes(
    tenantId: string,
    days = 7,
    limit = 20,
  ): Promise<ValidationInsightRow[]> {
    const since = new Date(Date.now() - days * DAY_MS);
    return this.db.nFe.findMany({
      where: {
        tenantId,
        deletedAt: null,
        statusValidacao: NfeValidationStatus.REJECTED,
        emitidaEm: { gte: since },
      },
      orderBy: { emitidaEm: "desc" },
      take: limit,
      select: {
        id: true,
        chave: true,
        numero: true,
        serie: true,
        cfop: true,
        tipo: true,
        mensagemValidacao: true,
        errosValidacao: true,
        emitidaEm: true,
      },
    });
  }

  async countValidationStatuses(tenantId: string, days = 7): Promise<ValidationStatusCounts> {
    const since = new Date(Date.now() - days * DAY_MS);
    const [rows, pendingAllTime] = await Promise.all([
      this.db.nFe.groupBy({
        by: ["statusValidacao"],
        where: { tenantId, deletedAt: null, emitidaEm: { gte: since } },
        _count: { _all: true },
      }),
      this.db.nFe.count({
        where: {
          tenantId,
          deletedAt: null,
          statusValidacao: NfeValidationStatus.PENDING,
        },
      }),
    ]);
    const map = Object.fromEntries(rows.map((r) => [r.statusValidacao, r._count._all]));
    return {
      approved: map[NfeValidationStatus.APPROVED] ?? 0,
      rejected: map[NfeValidationStatus.REJECTED] ?? 0,
      pending: map[NfeValidationStatus.PENDING] ?? 0,
      pendingAllTime,
    };
  }
}
