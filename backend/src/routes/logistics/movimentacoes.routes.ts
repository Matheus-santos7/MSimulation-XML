/**
 * Rotas logísticas — ponto de entrada da remessa física manual.
 * POST /movimentacoes/remessa → emitirRemessaManual (docs/remessa-fisica.md Fase 1).
 */
import type { FastifyInstance } from "fastify";
import { tenantIdFromRequest } from "../../lib/auth/request-context.js";
import {
  avancoCdBody,
  movimentacoesQuery,
  remessaManualBody,
  saldoCdQuery,
} from "../../schemas/logistics/unidades-logisticas.js";
import { emitirAvancoEntreCds, AvancoCdError } from "../../services/logistics/avanco-cd-service.js";
import { listarMovimentacoesProduto } from "../../services/logistics/movimentacao-produto-service.js";
import { emitirRemessaManual, listarSaldoRemessaPorCd, RemessaError } from "../../services/fiscal/index.js";
import { UnidadeLogisticaError } from "../../services/logistics/unidade-logistica-service.js";

export function registerMovimentacoesRoutes(app: FastifyInstance) {
  app.post("/movimentacoes/remessa", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = remessaManualBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    try {
      return await emitirRemessaManual(app.prisma, { tenantId, ...parsed.data });
    } catch (e) {
      if (e instanceof RemessaError || e instanceof UnidadeLogisticaError) {
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

  app.get("/movimentacoes/saldo-cd", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = saldoCdQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "productId obrigatório", details: parsed.error.flatten() });
    }
    return listarSaldoRemessaPorCd(
      app.prisma,
      tenantId,
      parsed.data.productId,
      parsed.data.productSku,
    );
  });
}
