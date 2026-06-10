import { prepareFiscalXmlForDownload } from "@msimulation-xml/fiscal-core";
import type { FastifyInstance } from "fastify";
import { NFeTipo } from "../../generated/prisma/client.js";
import { tenantIdFromRequest } from "../../lib/auth/request-context.js";
import { mapNfe } from "../../lib/fiscal/fiscal-mappers.js";
import {
  atualizarItensSaldoFifoParaNfes,
  CancelamentoError,
  cancelarVenda,
  DevolucaoError,
  emitirDevolucaoVenda,
  FiscalService,
  fiscalNotDeleted,
  InutilizacaoError,
  inutilizarNumeracao,
  resolveNfeXml,
  saldoLiquidoRemessaNfe,
} from "../../services/fiscal/index.js";
import { handleRouteError } from "../../lib/http/domain-errors.js";
import {
  cancelamentoBodySchema,
  chaveParamSchema,
  inutilizarBodySchema,
} from "../../schemas/fiscal/nfe.js";

const nfeListInclude = {
  nfeReferencia: { select: { chave: true } },
  itens: { include: { product: true }, orderBy: { numeroItem: "asc" as const } },
};

const NFE_STATUS_ERRORS = [InutilizacaoError, DevolucaoError, CancelamentoError] as const;

function isRemessaComSaldoFifo(tipo: NFeTipo): boolean {
  return tipo === NFeTipo.REMESSA || tipo === NFeTipo.REMESSA_SIMBOLICA;
}

export function registerNfeRoutes(app: FastifyInstance, fiscal: FiscalService) {
  app.get("/nfes", async (req) => {
    const tid = tenantIdFromRequest(req);
    const rows = await app.prisma.nFe.findMany({
      where: { tenantId: tid, ...fiscalNotDeleted },
      include: nfeListInclude,
      orderBy: [{ emitidaEm: "desc" }, { serie: "desc" }, { numero: "desc" }],
    });
    if (rows.length === 0) return [];
    await atualizarItensSaldoFifoParaNfes(app.prisma, tid, rows);
    return Promise.all(
      rows.map(async (r) => {
        const saldoFifo = isRemessaComSaldoFifo(r.tipo)
          ? await saldoLiquidoRemessaNfe(app.prisma, r.id, r.quantidade)
          : undefined;
        return mapNfe(r, r.nfeReferencia?.chave, r.itens, saldoFifo);
      }),
    );
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
    const xml = q.download === "1" ? prepareFiscalXmlForDownload(result.xml) : result.xml;
    if (q.download === "1") {
      headers["Content-Disposition"] = `attachment; filename="${result.filename}"`;
    }
    return reply.headers(headers).send(xml);
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

    if (isRemessaComSaldoFifo(row.tipo)) {
      await atualizarItensSaldoFifoParaNfes(app.prisma, tid, [row]);
    }
    const saldoFifo = isRemessaComSaldoFifo(row.tipo)
      ? await saldoLiquidoRemessaNfe(app.prisma, row.id, row.quantidade)
      : undefined;
    const dto = mapNfe(row, row.nfeReferencia?.chave, row.itens, saldoFifo);
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
