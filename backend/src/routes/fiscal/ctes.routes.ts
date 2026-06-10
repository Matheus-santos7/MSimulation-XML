import { prepareFiscalXmlForDownload } from "@msimulation-xml/fiscal-core";
import type { FastifyInstance } from "fastify";
import { tenantIdFromRequest } from "../../lib/auth/request-context.js";
import { mapCte } from "../../lib/fiscal/fiscal-mappers.js";
import { mapEmitente } from "../../lib/org/tenant-mapper.js";
import { FiscalService, fiscalNotDeleted, resolveCteXml } from "../../services/fiscal/index.js";
import { chaveParamSchema } from "../../schemas/fiscal/nfe.js";

export function registerCteAndEmitenteRoutes(app: FastifyInstance, fiscal: FiscalService) {
  app.get("/emitente", async (req) => {
    const tid = tenantIdFromRequest(req);
    const t = await app.prisma.tenant.findUniqueOrThrow({ where: { id: tid } });
    return mapEmitente(t);
  });

  app.get("/ctes", async (req) => {
    const tid = tenantIdFromRequest(req);
    const rows = await app.prisma.cTe.findMany({
      where: { tenantId: tid, ...fiscalNotDeleted },
      include: {
        nfeRemessa: { select: { chave: true } },
        nfeVenda: { select: { chave: true } },
      },
      orderBy: { emitidoEm: "desc" },
    });
    return rows.map((r) => mapCte(r));
  });

  app.get("/ctes/:chave/xml", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { chave } = chaveParamSchema.parse(req.params);
    const result = await resolveCteXml(app.prisma, tid, chave);
    if (!result) {
      const row = await app.prisma.cTe.findFirst({
        where: { chave, tenantId: tid, ...fiscalNotDeleted },
        select: { id: true },
      });
      if (!row) return reply.status(404).send({ error: "CT-e não encontrado" });
      return reply.status(409).send({ error: "XML do CT-e indisponível. Dados fiscais incompletos." });
    }

    const q = req.query as { download?: string };
    const headers: Record<string, string> = {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
      "X-CTe-Xml-Source": result.source,
    };
    const xml = q.download === "1" ? prepareFiscalXmlForDownload(result.xml) : result.xml;
    if (q.download === "1") {
      headers["Content-Disposition"] = `attachment; filename="${result.filename}"`;
    }
    return reply.headers(headers).send(xml);
  });

  app.get("/ctes/:chave", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { chave } = chaveParamSchema.parse(req.params);
    const row = await app.prisma.cTe.findFirst({
      where: { chave, tenantId: tid, ...fiscalNotDeleted },
      include: {
        nfeRemessa: { select: { chave: true } },
        nfeVenda: { select: { chave: true } },
      },
    });
    if (!row) return reply.status(404).send({ error: "CT-e não encontrado" });
    return mapCte(row);
  });

  app.delete("/ctes/:chave", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { chave } = chaveParamSchema.parse(req.params);
    const removed = await fiscal.softDeleteCte(chave, tid);
    if (!removed) return reply.status(404).send({ error: "CT-e não encontrado" });
    return reply.status(204).send();
  });
}
