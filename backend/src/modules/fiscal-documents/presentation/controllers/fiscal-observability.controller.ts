import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { mapTimeline } from "../../../../lib/fiscal/fiscal-mappers.js";
import { listTimelineChains } from "../../../../services/fiscal/shared/timeline-service.js";

async function listFiscalEventsForTenant(
  prisma: Parameters<typeof listTimelineChains>[0],
  tenantId: string,
) {
  const [rows, inutilizations] = await Promise.all([
    prisma.fiscalEvent.findMany({
      where: { tenantId },
      include: { nfe: true },
      orderBy: { ocorridoEm: "desc" },
    }),
    prisma.nfeInutilizacao.findMany({
      where: { tenantId },
      orderBy: { ocorridoEm: "desc" },
    }),
  ]);

  const events = rows.map((event) => ({
    id: event.id,
    tipo: event.tipo,
    descricao: event.descricao,
    chaveRef: event.nfe.chave,
    ocorridoEm: event.ocorridoEm.toISOString(),
    protocolo: event.protocolo,
    xJust: event.xJust ?? undefined,
  }));

  const numberInutilizations = inutilizations.map((row) => ({
    id: row.id,
    tipo: "INUT" as const,
    descricao: "Inutilização de numeração",
    serie: row.serie,
    numeroIni: row.numeroIni,
    numeroFim: row.numeroFim,
    ocorridoEm: row.ocorridoEm.toISOString(),
    protocolo: row.protocolo,
    xJust: row.xJust,
  }));

  return [...events, ...numberInutilizations].sort(
    (a, b) => new Date(b.ocorridoEm).getTime() - new Date(a.ocorridoEm).getTime(),
  );
}

export const fiscalObservabilityController: FastifyPluginAsync = async (app) => {
  app.get("/fiscal-events", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    return listFiscalEventsForTenant(app.prisma, tenantId);
  });

  app.get("/audit-logs", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const rows = await app.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { ocorridoEm: "desc" },
    });
    return rows.map((log) => ({
      id: log.id,
      ator: log.ator,
      acao: log.acao,
      recurso: log.recurso,
      ocorridoEm: log.ocorridoEm.toISOString(),
      hash: log.hash,
    }));
  });

  app.get("/timeline", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    return listTimelineChains(app.prisma, tenantId);
  });

  app.get("/timeline/steps", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const rows = await app.prisma.timelineStep.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(mapTimeline);
  });
};
