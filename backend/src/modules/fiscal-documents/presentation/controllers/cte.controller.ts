import { prepareFiscalXmlForDownload } from "@msimulation-xml/fiscal-core";
import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { requireAdminHook } from "../../../../plugins/contexts/guards.js";
import { mapEmitente } from "../../../org/infrastructure/fiscal/tenant-emitente.mapper.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { createFiscalDocumentsModule } from "../../infrastructure/factory/fiscal-documents-module.factory.js";
import { nfeAccessKeyParamSchema } from "../schemas/fiscal-document.schemas.js";

export const cteController: FastifyPluginAsync = async (app) => {
  const fiscalDocuments = createFiscalDocumentsModule();

  app.get("/emitente", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const tenant = await getDbClient().tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return mapEmitente(tenant);
  });

  app.get("/ctes", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    return fiscalDocuments.listCtes.execute(tenantId);
  });

  app.get("/ctes/:chave/xml", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { chave } = nfeAccessKeyParamSchema.parse(req.params);
    const result = await fiscalDocuments.getCteXml.execute(tenantId, chave);
    if (!result) {
      const exists = await fiscalDocuments.getCteXml.cteExists(tenantId, chave);
      if (!exists) return reply.status(404).send({ error: "CT-e não encontrado" });
      return reply.status(409).send({ error: "XML do CT-e indisponível. Dados fiscais incompletos." });
    }

    const query = req.query as { download?: string };
    const headers: Record<string, string> = {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
      "X-CTe-Xml-Source": result.source,
    };
    const xml = query.download === "1" ? prepareFiscalXmlForDownload(result.xml) : result.xml;
    if (query.download === "1") {
      headers["Content-Disposition"] = `attachment; filename="${result.filename}"`;
    }
    return reply.headers(headers).send(xml);
  });

  app.get("/ctes/:chave", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { chave } = nfeAccessKeyParamSchema.parse(req.params);
    const cte = await fiscalDocuments.getCteByKey.execute(tenantId, chave);
    if (!cte) return reply.status(404).send({ error: "CT-e não encontrado" });
    return cte;
  });

  app.delete("/ctes/:chave", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { chave } = nfeAccessKeyParamSchema.parse(req.params);
    const removed = await fiscalDocuments.softDeleteCte.execute(chave, tenantId);
    if (!removed) return reply.status(404).send({ error: "CT-e não encontrado" });
    return reply.status(204).send();
  });
};
