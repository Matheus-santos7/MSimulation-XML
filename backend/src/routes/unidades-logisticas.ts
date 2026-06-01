import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { tenantIdFromRequest } from "../lib/auth/request-context.js";
import {
  UnidadeLogisticaError,
  UnidadeLogisticaService,
  type UnidadeLogisticaImportRow,
} from "../services/unidade-logistica-service.js";
import { emitirAvancoEntreCds, AvancoCdError } from "../services/avanco-cd-service.js";
import { listarMovimentacoesProduto } from "../services/movimentacao-produto-service.js";

const importRowSchema = z.object({
  unidade: z.string().min(1),
  cnpj: z.union([z.string(), z.number()]),
  inscricaoEstadual: z.union([z.string(), z.number()]).optional(),
  logradouro: z.string(),
  numero: z.string(),
  cidade: z.string(),
  uf: z.string().min(2).max(2),
  cep: z.union([z.string(), z.number()]),
});

const unidadesListQuery = z.object({
  ativa: z.enum(["true", "false"]).optional(),
  q: z.string().optional(),
});

const movimentacoesQuery = z.object({
  productId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

const avancoCdBody = z.object({
  productId: z.string().uuid(),
  quantidade: z.number().int().min(1),
  unidadeOrigemId: z.string().uuid(),
  unidadeDestinoId: z.string().uuid(),
});

export async function unidadesLogisticasRoutes(app: FastifyInstance) {
  app.get("/unidades-logisticas", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const q = unidadesListQuery.parse(req.query);
    const service = new UnidadeLogisticaService(app.prisma);
    const ativa = q.ativa === "false" ? false : q.ativa === "true" ? true : undefined;
    return service.list(tenantId, { ativa, q: q.q });
  });

  app.get("/unidades-logisticas/:id", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { id } = req.params as { id: string };
    const service = new UnidadeLogisticaService(app.prisma);
    const row = await service.getById(tenantId, id);
    if (!row) return reply.status(404).send({ error: "Unidade não encontrada" });
    return row;
  });

  app.post("/unidades-logisticas/bulk-import", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const body = req.body as { rows?: UnidadeLogisticaImportRow[]; enrichCep?: boolean };
    const parsed = z.array(importRowSchema).safeParse(body.rows ?? []);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Linhas inválidas", details: parsed.error.flatten() });
    }
    try {
      const service = new UnidadeLogisticaService(app.prisma);
      const rows: UnidadeLogisticaImportRow[] = parsed.data.map((r) => ({
        ...r,
        cnpj: r.cnpj,
        cep: r.cep,
        inscricaoEstadual: r.inscricaoEstadual,
      }));
      return await service.bulkImport(tenantId, rows, body.enrichCep !== false);
    } catch (e) {
      if (e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.patch("/unidades-logisticas/:id/padrao", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const { id } = req.params as { id: string };
    try {
      const service = new UnidadeLogisticaService(app.prisma);
      return await service.setPadrao(tenantId, id);
    } catch (e) {
      if (e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.post("/movimentacoes/avanco-cd", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = avancoCdBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    try {
      return await emitirAvancoEntreCds(app.prisma, { tenantId, ...parsed.data });
    } catch (e) {
      if (e instanceof AvancoCdError || e instanceof UnidadeLogisticaError) {
        return reply.status(400).send({ error: e.message });
      }
      throw e;
    }
  });

  app.get("/movimentacoes-produto", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const q = movimentacoesQuery.parse(req.query);
    return listarMovimentacoesProduto(app.prisma, tenantId, {
      productId: q.productId,
      limit: q.limit,
    });
  });
}
