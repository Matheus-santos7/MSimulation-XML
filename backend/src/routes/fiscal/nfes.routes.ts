import type { FastifyInstance } from "fastify";
import { tenantIdFromRequest } from "../../lib/auth/request-context.js";
import { mapNfe } from "../../lib/fiscal-mappers.js";
import { FiscalService, fiscalNotDeleted } from "../../services/fiscal-service.js";
import { CancelamentoError, cancelarVenda } from "../../services/cancelamento-service.js";
import { DevolucaoError, emitirDevolucaoVenda } from "../../services/devolucao-service.js";
import { InutilizacaoError, inutilizarNumeracao } from "../../services/inutilizacao-service.js";
import { resolveNfeXml } from "../../services/nfe-xml-service.js";
import { handleRouteError } from "../../lib/http/domain-errors.js";
import {
  cancelamentoBodySchema,
  chaveParamSchema,
  inutilizarBodySchema,
} from "./schemas.js";

const nfeListInclude = {
  nfeReferencia: { select: { chave: true } },
  itens: { include: { product: true }, orderBy: { numeroItem: "asc" as const } },
};

const NFE_STATUS_ERRORS = [InutilizacaoError, DevolucaoError, CancelamentoError] as const;

export function registerNfeRoutes(app: FastifyInstance, fiscal: FiscalService) {
  app.get("/nfes", async (req) => {
    const tid = tenantIdFromRequest(req);
    const rows = await app.prisma.nFe.findMany({
      where: { tenantId: tid, ...fiscalNotDeleted },
      include: nfeListInclude,
      orderBy: [{ emitidaEm: "desc" }, { serie: "desc" }, { numero: "desc" }],
    });
    return rows.map((r) => mapNfe(r, r.nfeReferencia?.chave, r.itens));
  });

  app.get("/nfes/:chave/xml", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { chave } = chaveParamSchema.parse(req.params);
    const result = await resolveNfeXml(app.prisma, tid, chave);
    if (!result) {
      const row = await app.prisma.nFe.findFirst({
        where: { chave, tenantId: tid, ...fiscalNotDeleted },
        select: { tipo: true },
      });
      if (!row) return reply.status(404).send({ error: "NF-e não encontrada" });
      return reply.status(409).send({
        error: `XML persistido indisponível para NF-e tipo ${row.tipo}. Migração pendente.`,
      });
    }

    const q = req.query as { download?: string };
    const headers: Record<string, string> = {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
      "X-NFe-Xml-Source": result.source,
    };
    if (q.download === "1") {
      headers["Content-Disposition"] = `attachment; filename="${result.filename}"`;
    }
    return reply.headers(headers).send(result.xml);
  });

  app.get("/nfes/:chave", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { chave } = chaveParamSchema.parse(req.params);
    const row = await app.prisma.nFe.findFirst({
      where: { chave, tenantId: tid, ...fiscalNotDeleted },
      include: {
        cteRemessa: { select: { chave: true } },
        cteVenda: { select: { chave: true } },
        nfeReferencia: { select: { chave: true, tipo: true, numero: true, serie: true } },
        nfeReferenciadas: { select: { chave: true, tipo: true, numero: true, serie: true } },
        itens: { include: { product: true }, orderBy: { numeroItem: "asc" } },
      },
    });
    if (!row) return reply.status(404).send({ error: "NF-e não encontrada" });

    const dto = mapNfe(row, row.nfeReferencia?.chave, row.itens);
    return {
      ...dto,
      cteChaveRef: row.cteRemessa?.chave ?? row.cteVenda?.chave,
      referenciadas: row.nfeReferenciadas.map((n) => ({
        chave: n.chave,
        tipo: n.tipo,
        numero: n.numero,
        serie: n.serie,
      })),
    };
  });

  // Rota estática antes das rotas com `:chave` (evita ambiguidade no roteador).
  app.post("/nfes/inutilizar", async (req, reply) => {
    try {
      const tid = tenantIdFromRequest(req);
      const body = inutilizarBodySchema.parse(req.body ?? {});
      const result = await inutilizarNumeracao(app.prisma, {
        tenantId: tid,
        serie: body.serie,
        numeroIni: body.numeroIni,
        numeroFim: body.numeroFim,
        xJust: body.xJust,
      });
      return reply.status(201).send(result);
    } catch (e) {
      if (handleRouteError(reply, e, { statusErrors: [...NFE_STATUS_ERRORS] })) return;
      throw e;
    }
  });

  app.delete("/nfes/:chave", async (req, reply) => {
    const tid = tenantIdFromRequest(req);
    const { chave } = chaveParamSchema.parse(req.params);
    const removed = await fiscal.softDeleteNfe(chave, tid);
    if (!removed) return reply.status(404).send({ error: "NF-e não encontrada" });
    return reply.status(204).send();
  });

  app.post("/nfes/:chave/devolucao", async (req, reply) => {
    try {
      const tid = tenantIdFromRequest(req);
      const { chave } = chaveParamSchema.parse(req.params);
      const result = await emitirDevolucaoVenda(app.prisma, chave, tid);
      return reply.status(201).send(result);
    } catch (e) {
      if (handleRouteError(reply, e, { statusErrors: [...NFE_STATUS_ERRORS] })) return;
      throw e;
    }
  });

  app.post("/nfes/:chave/cancelamento", async (req, reply) => {
    try {
      const tid = tenantIdFromRequest(req);
      const { chave } = chaveParamSchema.parse(req.params);
      const body = cancelamentoBodySchema.parse(req.body ?? {});
      const result = await cancelarVenda(app.prisma, chave, tid, body.xJust);
      return reply.status(200).send(result);
    } catch (e) {
      if (handleRouteError(reply, e, { statusErrors: [...NFE_STATUS_ERRORS] })) return;
      throw e;
    }
  });
}
