import { prepareFiscalXmlForDownload } from "@msimulation-xml/fiscal-core";
import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { createFiscalDocumentsModule } from "../../infrastructure/factory/fiscal-documents-module.factory.js";
import { nfeAccessKeyParamSchema } from "../schemas/fiscal-document.schemas.js";

export const nfeController: FastifyPluginAsync = async (app) => {
  const fiscalDocuments = createFiscalDocumentsModule(app.prisma);

  app.get("/nfes", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    return fiscalDocuments.listNfes.execute(tenantId);
  });

  app.get("/nfes/:chave/xml", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { chave } = nfeAccessKeyParamSchema.parse(req.params);
    const result = await fiscalDocuments.getNfeXml.execute(tenantId, chave);
    if (!result) {
      const tipo = await fiscalDocuments.getNfeXml.getTipoWhenMissing(tenantId, chave);
      if (!tipo) return reply.status(404).send({ error: "NF-e não encontrada" });
      return reply.status(409).send({
        error: `XML persistido indisponível para NF-e tipo ${tipo}. Migração pendente.`,
      });
    }

    const query = req.query as { download?: string };
    const headers: Record<string, string> = {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
      "X-NFe-Xml-Source": result.source,
    };
    const xml = query.download === "1" ? prepareFiscalXmlForDownload(result.xml) : result.xml;
    if (query.download === "1") {
      headers["Content-Disposition"] = `attachment; filename="${result.filename}"`;
    }
    return reply.headers(headers).send(xml);
  });

  app.get("/nfes/:chave", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { chave } = nfeAccessKeyParamSchema.parse(req.params);
    const nfe = await fiscalDocuments.getNfeByKey.execute(tenantId, chave);
    if (!nfe) return reply.status(404).send({ error: "NF-e não encontrada" });
    return nfe;
  });

  app.delete("/nfes/:chave", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { chave } = nfeAccessKeyParamSchema.parse(req.params);
    const removed = await fiscalDocuments.softDeleteNfe.execute(chave, tenantId);
    if (!removed) return reply.status(404).send({ error: "NF-e não encontrada" });
    return reply.status(204).send();
  });
};
