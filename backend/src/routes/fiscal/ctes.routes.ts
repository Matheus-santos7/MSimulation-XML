import type { FastifyInstance } from "fastify";
import { tenantIdFromRequest } from "../../lib/auth/request-context.js";
import { mapCte } from "../../lib/fiscal-mappers.js";
import { mapEmitente } from "../../lib/tenant-mapper.js";
import { FiscalService, fiscalNotDeleted } from "../../services/fiscal-service.js";
import { chaveParamSchema } from "./schemas.js";

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
      include: { nfeRemessa: { select: { chave: true } } },
      orderBy: { emitidoEm: "desc" },
    });
    return rows.map((r) => mapCte(r, r.nfeRemessa?.chave));
  });

  app.get("/ctes/:chave", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { chave } = chaveParamSchema.parse(req.params);
    const row = await app.prisma.cTe.findFirst({
      where: { chave, tenantId: tid, ...fiscalNotDeleted },
      include: { nfeRemessa: { select: { chave: true } } },
    });
    if (!row) return reply.status(404).send({ error: "CT-e não encontrado" });
    return mapCte(row, row.nfeRemessa?.chave);
  });

  app.delete("/ctes/:chave", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { chave } = chaveParamSchema.parse(req.params);
    const removed = await fiscal.softDeleteCte(chave, tid);
    if (!removed) return reply.status(404).send({ error: "CT-e não encontrado" });
    return reply.status(204).send();
  });
}
