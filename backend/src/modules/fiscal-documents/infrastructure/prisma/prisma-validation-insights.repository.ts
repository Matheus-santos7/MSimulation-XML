import { NfeValidationStatus } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";

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

export async function listRecentRejectedNfes(
  db: DbClient,
  tenantId: string,
  days = 7,
  limit = 20,
): Promise<ValidationInsightRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db.nFe.findMany({
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

export async function countValidationStatuses(
  db: DbClient,
  tenantId: string,
  days = 7,
): Promise<{ approved: number; rejected: number; pending: number }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.nFe.groupBy({
    by: ["statusValidacao"],
    where: { tenantId, deletedAt: null, emitidaEm: { gte: since } },
    _count: { _all: true },
  });
  const map = Object.fromEntries(rows.map((r) => [r.statusValidacao, r._count._all]));
  return {
    approved: map[NfeValidationStatus.APPROVED] ?? 0,
    rejected: map[NfeValidationStatus.REJECTED] ?? 0,
    pending: map[NfeValidationStatus.PENDING] ?? 0,
  };
}
