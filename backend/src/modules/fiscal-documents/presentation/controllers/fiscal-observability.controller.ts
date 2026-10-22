import { fiscalXmlDownloadFilename } from "@msimulation-xml/fiscal-core";
import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { sendFile, XLSX_CONTENT_TYPE } from "../../../../nest/http/file-download.js";
import { orNotFound } from "../../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { mapEmitente } from "../../../org/index.js";
import { buildProcInutNFeXML, infInutId } from "../../domain/services/inutilizacao-xml.js";
import { ufToCodigo } from "../../domain/services/nfe-chave.js";
import { listTimelineChains } from "../../infrastructure/observability/timeline-service.js";
import { exportTimelineSpreadsheet } from "../../infrastructure/observability/timeline-spreadsheet.service.js";
import { isDownloadRequested, sendFiscalXml } from "../helpers/fiscal-xml-response.js";
import { mapTimeline } from "../mappers/fiscal-mappers.js";

const fiscalEventIdParam = z.object({ id: z.string().min(1) });

type DbClient = Parameters<typeof listTimelineChains>[0];

async function listFiscalEventsForTenant(prisma: DbClient, tenantId: string) {
  const [rows, inutilizations] = await Promise.all([
    prisma.fiscalEvent.findMany({
      where: { tenantId },
      // Só a chave — `nfe: true` puxava xmlAutorizado (@db.Text) de cada NF-e.
      include: { nfe: { select: { chave: true } } },
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

/** XML `procInutNFe` de uma inutilização, com o nome de arquivo derivado do Id. */
async function buildInutilizationXml(db: DbClient, tenantId: string, inutilizationId: string) {
  const inut = orNotFound(
    await db.nfeInutilizacao.findFirst({ where: { id: inutilizationId, tenantId } }),
    "Inutilização não encontrada",
  );
  const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
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

  return { xml, filename: fiscalXmlDownloadFilename("Inut", chave) };
}

/**
 * Observabilidade fiscal do tenant.
 *
 * | Método | Rota | Responsabilidade |
 * |--------|------|------------------|
 * | GET | `/fiscal-events` | eventos fiscais + inutilizações |
 * | GET | `/fiscal-events/:id/xml` | XML da inutilização |
 * | GET | `/audit-logs` | trilha de auditoria |
 * | GET | `/timeline` | cadeias fiscais |
 * | GET | `/timeline/spreadsheet/export` | cenários fiscais em XLSX |
 * | GET | `/timeline/steps` | etapas da timeline |
 */
@Controller()
@ProtectedApi()
export class FiscalObservabilityController {
  @Get("fiscal-events")
  fiscalEvents(@TenantId() tenantId: string) {
    return listFiscalEventsForTenant(getDbClient(), tenantId);
  }

  @Get("fiscal-events/:id/xml")
  async inutilizationXml(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(fiscalEventIdParam)) params: z.infer<typeof fiscalEventIdParam>,
    @Query() query: { download?: string },
    @Res() reply: FastifyReply,
  ) {
    const { xml, filename } = await buildInutilizationXml(getDbClient(), tenantId, params.id);

    return sendFiscalXml(reply, { xml, filename, download: isDownloadRequested(query) });
  }

  @Get("audit-logs")
  async auditLogs(@TenantId() tenantId: string) {
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
  }

  @Get("timeline")
  timeline(@TenantId() tenantId: string) {
    return listTimelineChains(getDbClient(), tenantId);
  }

  /** Exportação XLSX de todos os cenários fiscais do tenant (organização operacional). */
  @Get("timeline/spreadsheet/export")
  async exportTimeline(@TenantId() tenantId: string, @Res() reply: FastifyReply) {
    return sendFile(reply, {
      content: await exportTimelineSpreadsheet(getDbClient(), tenantId),
      contentType: XLSX_CONTENT_TYPE,
      fileName: "cenarios-fiscais.xlsx",
    });
  }

  @Get("timeline/steps")
  async timelineSteps(@TenantId() tenantId: string) {
    const rows = await getDbClient().timelineStep.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
    });

    return rows.map(mapTimeline);
  }
}
