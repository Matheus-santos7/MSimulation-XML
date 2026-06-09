import type { FastifyInstance } from "fastify";
import { tenantIdFromRequest } from "../../lib/auth/request-context.js";
import { mapTimeline } from "../../lib/fiscal-mappers.js";
import { listTimelineChains } from "../../services/fiscal/timeline-service.js";

async function listFiscalEventsForTenant(app: FastifyInstance, tenantId: string) {
  const [rows, inuts] = await Promise.all([
    app.prisma.fiscalEvent.findMany({
      where: { tenantId },
      include: { nfe: true },
      orderBy: { ocorridoEm: "desc" },
    }),
    app.prisma.nfeInutilizacao.findMany({
      where: { tenantId },
      orderBy: { ocorridoEm: "desc" },
    }),
  ]);

  const eventos = rows.map((e) => ({
    id: e.id,
    tipo: e.tipo,
    descricao: e.descricao,
    chaveRef: e.nfe.chave,
    ocorridoEm: e.ocorridoEm.toISOString(),
    protocolo: e.protocolo,
    xJust: e.xJust ?? undefined,
  }));

  const inutilizacoes = inuts.map((i) => ({
    id: i.id,
    tipo: "INUT" as const,
    descricao: "Inutilização de numeração",
    serie: i.serie,
    numeroIni: i.numeroIni,
    numeroFim: i.numeroFim,
    ocorridoEm: i.ocorridoEm.toISOString(),
    protocolo: i.protocolo,
    xJust: i.xJust,
  }));

  return [...eventos, ...inutilizacoes].sort(
    (a, b) => new Date(b.ocorridoEm).getTime() - new Date(a.ocorridoEm).getTime(),
  );
}

export function registerObservabilityRoutes(app: FastifyInstance) {
  app.get("/fiscal-events", async (req) => {
    const tid = tenantIdFromRequest(req);
    return listFiscalEventsForTenant(app, tid);
  });

  app.get("/audit-logs", async (req) => {
    const tid = tenantIdFromRequest(req);
    const rows = await app.prisma.auditLog.findMany({
      where: { tenantId: tid },
      orderBy: { ocorridoEm: "desc" },
    });
    return rows.map((a) => ({
      id: a.id,
      ator: a.ator,
      acao: a.acao,
      recurso: a.recurso,
      ocorridoEm: a.ocorridoEm.toISOString(),
      hash: a.hash,
    }));
  });

  /** Cadeias: remessa → retorno → venda → (devolução). */
  app.get("/timeline", async (req) => {
    const tid = tenantIdFromRequest(req);
    return listTimelineChains(app.prisma, tid);
  });

  /** Passos estáticos do seed (UI legada). */
  app.get("/timeline/steps", async (req) => {
    const tid = tenantIdFromRequest(req);
    const rows = await app.prisma.timelineStep.findMany({
      where: { tenantId: tid },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(mapTimeline);
  });
}
