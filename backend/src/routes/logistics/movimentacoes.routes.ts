/**
 * Rotas logísticas — ponto de entrada da remessa física manual.
 * POST /movimentacoes/remessa → módulo Remessas (EmitirRemessaInicialUseCase).
 */
import type { FastifyInstance } from "fastify";
import { tenantIdFromRequest } from "../../lib/auth/request-context.js";
import {
  avancoCdBody,
  movimentacoesQuery,
  realignFifoBody,
  remessaManualBody,
  saldoCdQuery,
} from "../../schemas/logistics/unidades-logisticas.js";
import { listarMovimentacoesProduto } from "../../services/logistics/movimentacao-produto-service.js";
import {
  listarSaldoRemessaPorCd,
  realignRemessaFifoProductIdsBySku,
  RemessaError,
  SaldoRemessaInsuficienteError,
} from "../../services/fiscal/index.js";
import { UnidadeLogisticaError } from "../../services/logistics/unidade-logistica-service.js";
import {
  RemessaDomainError,
  SaldoFifoInsuficienteError,
  createRemessasModule,
} from "../../modules/remessas/index.js";
import { mapAvancoMercadoriaParaApi } from "../../modules/remessas/presentation/avanco-api.mapper.js";
import { RemessaSimbolicaFiscalError } from "../../services/fiscal/remessa/remessa-simbolica-fiscal.js";
import { resolveProductForAvanco, hasRemessaSaldoForAvanco } from "../../services/logistics/avanco-product-resolve.js";

function mapRemessaModuleError(e: unknown): { status: number; message: string } | null {
  if (
    e instanceof RemessaDomainError ||
    e instanceof SaldoFifoInsuficienteError ||
    e instanceof SaldoRemessaInsuficienteError
  ) {
    return { status: 400, message: e.message };
  }
  if (e instanceof RemessaError || e instanceof RemessaSimbolicaFiscalError) {
    return { status: 400, message: e.message };
  }
  if (e instanceof UnidadeLogisticaError) {
    return { status: 400, message: e.message };
  }
  if (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2028"
  ) {
    return {
      status: 503,
      message:
        "A emissão demorou mais que o esperado. Tente novamente; se persistir, reduza a quantidade ou contate o suporte.",
    };
  }
  return null;
}

export function registerMovimentacoesRoutes(app: FastifyInstance) {
  const remessas = createRemessasModule(app.prisma);

  app.post("/movimentacoes/remessa", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = remessaManualBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    try {
      return await remessas.emitirRemessaInicial.execute({
        tenantId,
        unidadeDestinoId: parsed.data.unidadeDestinoId,
        items: parsed.data.items,
      });
    } catch (e) {
      const mapped = mapRemessaModuleError(e);
      if (mapped) return reply.status(mapped.status).send({ error: mapped.message });
      throw e;
    }
  });

  app.post("/movimentacoes/avanco-cd", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = avancoCdBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }

    const productId = parsed.data.productId.trim();
    const resolved = await resolveProductForAvanco(
      app.prisma,
      tenantId,
      productId,
      parsed.data.productSku,
    );
    if (!resolved) {
      const temSaldo = await hasRemessaSaldoForAvanco(
        app.prisma,
        tenantId,
        productId,
        parsed.data.productSku,
      );
      const skuHint = parsed.data.productSku?.trim()
        ? ` (SKU ${parsed.data.productSku.trim()})`
        : "";
      if (temSaldo) {
        return reply.status(400).send({
          error: `Há saldo FIFO${skuHint}, mas o produto não está no cadastro desta empresa. Abra Produtos e confira se o SKU está cadastrado com regra fiscal e preço de custo.`,
        });
      }
      return reply.status(400).send({
        error: `Produto não encontrado nesta empresa${skuHint}. Cadastre em Produtos ou emita nova remessa física para o CD de origem.`,
      });
    }

    try {
      const result = await remessas.emitirAvancoMercadoria.execute({
        tenantId,
        productId,
        productSku: parsed.data.productSku,
        quantidade: parsed.data.quantidade,
        unidadeOrigemId: parsed.data.unidadeOrigemId,
        unidadeDestinoId: parsed.data.unidadeDestinoId,
      });
      return mapAvancoMercadoriaParaApi(app.prisma, result);
    } catch (e) {
      const mapped = mapRemessaModuleError(e);
      if (mapped) return reply.status(mapped.status).send({ error: mapped.message });
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

  app.post("/movimentacoes/remessa/realign-fifo", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = realignFifoBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "SKU obrigatório", details: parsed.error.flatten() });
    }
    const result = await realignRemessaFifoProductIdsBySku(
      app.prisma,
      tenantId,
      parsed.data.productSku,
    );
    return result;
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
