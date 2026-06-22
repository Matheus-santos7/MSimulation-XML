/**
 * Controller HTTP de movimentações físicas e avanço entre CDs.
 *
 * Orquestra logistics (resolução de produto, listagem) com **remessas** (emissão fiscal).
 *
 * | Método | Rota | Responsabilidade |
 * |--------|------|------------------|
 * | POST | `/movimentacoes/remessa` | Remessa física inicial (ADMIN) |
 * | POST | `/movimentacoes/transferencia-filial` | Transferência entre filiais (ADMIN) |
 * | POST | `/movimentacoes/avanco-cd` | Avanço de mercadoria entre CDs (ADMIN) |
 * | GET | `/movimentacoes-produto` | ListProductMovementsUseCase |
 * | GET | `/movimentacoes/saldo-cd` | Saldo FIFO por CD (remessas) |
 * | POST | `/movimentacoes/remessa/realign-fifo` | Realinhamento FIFO (ADMIN) |
 */
import type { FastifyPluginAsync } from "fastify";
import { tenantIdFromRequest } from "../../../../lib/auth/request-context.js";
import { requireAdminHook } from "../../../../plugins/contexts/guards.js";
import { SymbolicShipmentFiscalError } from "../../../remessas/infrastructure/fiscal/symbolic-shipment/index.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import {
  RemessaDomainError,
  SaldoFifoInsuficienteError,
  SaldoRemessaInsuficienteError,
  createRemessasModule,
  listRemessaBalanceByCd,
  realignRemessaFifoProductIdsBySku,
  ShipmentError,
} from "../../../remessas/index.js";
import { EmitenteFiscalConfigError } from "../../../org/index.js";
import {
  BranchTransferError,
  emitBranchTransfer,
} from "../../../remessas/infrastructure/fiscal/branch-transfer/index.js";
import { mapAvancoMercadoriaParaApi } from "../../../remessas/presentation/avanco-api.mapper.js";
import { LogisticsUnitError } from "../../domain/errors/logistics-unit.error.js";
import { createLogisticsModule } from "../../infrastructure/factory/logistics-module.factory.js";
import {
  advanceWarehouseBody,
  manualShipmentBody,
  productMovementsQuery,
  realignFifoBody,
  transferenciaFilialBody,
  warehouseBalanceQuery,
} from "../schemas/logistics.schemas.js";

function mapRemessaModuleError(e: unknown): { status: number; message: string } | null {
  if (
    e instanceof RemessaDomainError ||
    e instanceof SaldoFifoInsuficienteError ||
    e instanceof SaldoRemessaInsuficienteError
  ) {
    return { status: 400, message: e.message };
  }
  if (e instanceof ShipmentError || e instanceof SymbolicShipmentFiscalError) {
    return { status: 400, message: e.message };
  }
  if (e instanceof BranchTransferError || e instanceof EmitenteFiscalConfigError) {
    return { status: 400, message: e.message };
  }
  if (e instanceof LogisticsUnitError) {
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

export const movementController: FastifyPluginAsync = async (app) => {
  const logistics = createLogisticsModule();
  const remessas = createRemessasModule();

  app.post("/movimentacoes/remessa", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = manualShipmentBody.safeParse(req.body);
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

  app.post("/movimentacoes/transferencia-filial", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = transferenciaFilialBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }
    try {
      return await emitBranchTransfer(getDbClient(), {
        tenantId,
        filialId: parsed.data.filialId,
        items: parsed.data.items,
      });
    } catch (e) {
      const mapped = mapRemessaModuleError(e);
      if (mapped) return reply.status(mapped.status).send({ error: mapped.message });
      throw e;
    }
  });

  app.post("/movimentacoes/avanco-cd", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = advanceWarehouseBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Payload inválido", details: parsed.error.flatten() });
    }

    const productId = parsed.data.productId.trim();
    const resolved = await logistics.resolveAdvanceProduct.execute(
      tenantId,
      productId,
      parsed.data.productSku,
    );
    if (!resolved) {
      const hasStock = await logistics.hasAdvanceStock.execute(
        tenantId,
        productId,
        parsed.data.productSku,
      );
      const skuHint = parsed.data.productSku?.trim()
        ? ` (SKU ${parsed.data.productSku.trim()})`
        : "";
      if (hasStock) {
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
      return mapAvancoMercadoriaParaApi(getDbClient(), result);
    } catch (e) {
      const mapped = mapRemessaModuleError(e);
      if (mapped) return reply.status(mapped.status).send({ error: mapped.message });
      throw e;
    }
  });

  app.get("/movimentacoes-produto", async (req) => {
    const tenantId = tenantIdFromRequest(req);
    const q = productMovementsQuery.parse(req.query);
    return logistics.listProductMovements.execute(tenantId, {
      productId: q.productId,
      limit: q.limit,
    });
  });

  app.post("/movimentacoes/remessa/realign-fifo", { onRequest: [requireAdminHook] }, async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = realignFifoBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "SKU obrigatório", details: parsed.error.flatten() });
    }
    return realignRemessaFifoProductIdsBySku(getDbClient(), tenantId, parsed.data.productSku);
  });

  app.get("/movimentacoes/saldo-cd", async (req, reply) => {
    const tenantId = tenantIdFromRequest(req);
    const parsed = warehouseBalanceQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "productId obrigatório", details: parsed.error.flatten() });
    }
    return listRemessaBalanceByCd(
      getDbClient(),
      tenantId,
      parsed.data.productId,
      parsed.data.productSku,
    );
  });
};
