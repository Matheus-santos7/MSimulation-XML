import { fiscalXmlDownloadFilename, prepareFiscalXmlForDownload } from "@msimulation-xml/fiscal-core";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { buildProcInutNFeXML, infInutId } from "../../domain/services/inutilizacao-xml.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { mapTimeline } from "../mappers/fiscal-mappers.js";
import { ufToCodigo } from "../../domain/services/nfe-chave.js";
import { mapEmitente } from "../../../org/infrastructure/fiscal/tenant-emitente.mapper.js";
import { listTimelineChains } from "../../infrastructure/observability/timeline-service.js";
import { exportTimelineSpreadsheet } from "../../infrastructure/observability/timeline-spreadsheet.service.js";
import { GetValidationInsightsUseCase } from "../../application/use-cases/get-validation-insights.use-case.js";
import { BackfillNfeValidationUseCase } from "../../application/use-cases/backfill-nfe-validation.use-case.js";
import { requireAdminHook } from "../../../../plugins/contexts/guards.js";
import { getFiscalValidatorStatus } from "../../../../lib/fiscal-validator-status.js";

const fiscalEventIdParam = z.object({ id: z.string().min(1) });
const backfillValidationBodySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});
const getValidationInsights = new GetValidationInsightsUseCase();
const backfillNfeValidation = new BackfillNfeValidationUseCase();

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
    return listFiscalEventsForTenant(getDbClient(), tenantId);
  });

  app.get("/fiscal-events/:id/xml", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { id } = fiscalEventIdParam.parse(req.params);
    const query = req.query as { download?: string };

    const inut = await getDbClient().nfeInutilizacao.findFirst({
      where: { id, tenantId },
    });
    if (!inut) {
      return reply.status(404).send({ error: "Inutilização não encontrada" });
    }

    const tenant = await getDbClient().tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const emit = mapEmitente(tenant);
    const xml = buildProcInutNFeXML(
      { emitenteUf: emit.uf, emitenteCnpj: emit.cnpj },
      {
        emitenteUf: emit.uf,
        emitenteCnpj: emit.cnpj,
        serie: inut.serie,
        numeroIni: inut.numeroIni,
        numeroFim: inut.numeroFim,
        protocolo: inut.protocolo,
        ocorridoEm: inut.ocorridoEm.toISOString(),
        xJust: inut.xJust,
      },
    );

    const cUfCode = String(ufToCodigo(emit.uf)).padStart(2, "0");
    const ano = String(inut.ocorridoEm.getFullYear()).slice(-2);
    const cnpj = emit.cnpj.replace(/\D/g, "");
    const chave = infInutId(cUfCode, ano, cnpj, inut.serie, inut.numeroIni, inut.numeroFim);
    const filename = fiscalXmlDownloadFilename("Inut", chave);

    const headers: Record<string, string> = {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
    };
    const body = query.download === "1" ? prepareFiscalXmlForDownload(xml) : xml;
    if (query.download === "1") {
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }
    return reply.headers(headers).send(body);
  });

  app.get("/audit-logs", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const rows = await getDbClient().auditLog.findMany({
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
    return listTimelineChains(getDbClient(), tenantId);
  });

  app.get("/timeline/spreadsheet/export", async (req, reply) => {
    /** Exportação XLSX de todos os cenários fiscais do tenant (organização operacional). */
    const tenantId = tenantIdFromRequest(req);
    const buffer = await exportTimelineSpreadsheet(getDbClient(), tenantId);
    return reply
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )
      .header("Content-Disposition", 'attachment; filename="cenarios-fiscais.xlsx"')
      .send(buffer);
  });

  app.get("/timeline/steps", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const rows = await getDbClient().timelineStep.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(mapTimeline);
  });

  app.get("/fiscal-validation/insights", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    return getValidationInsights.execute(getDbClient(), tenantId);
  });

  app.get("/fiscal-validation/status", async () => {
    return getFiscalValidatorStatus();
  });

  app.post("/fiscal-validation/backfill", { onRequest: [requireAdminHook] }, async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const body = backfillValidationBodySchema.parse(req.body ?? {});
    return backfillNfeValidation.execute(getDbClient(), tenantId, { limit: body.limit });
  });
};
