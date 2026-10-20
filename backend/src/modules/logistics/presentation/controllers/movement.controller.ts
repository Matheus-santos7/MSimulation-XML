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
import { Body, Controller, Get, HttpCode, Inject, Post, Query } from "@nestjs/common";
import type { z } from "zod";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { HttpError } from "../../../../lib/http/http-error.js";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { EmitenteFiscalConfigError } from "../../../org/index.js";
import {
  RemessaDomainError,
  SaldoFifoInsuficienteError,
  SaldoRemessaInsuficienteError,
  listRemessaBalanceByCd,
  realignRemessaFifoProductIdsBySku,
  ShipmentError,
} from "../../../remessas/index.js";
import { BranchTransferError, emitBranchTransfer } from "../../../remessas/infrastructure/fiscal/branch-transfer/index.js";
import { SymbolicShipmentFiscalError } from "../../../remessas/infrastructure/fiscal/symbolic-shipment/index.js";
import { mapAvancoMercadoriaParaApi } from "../../../remessas/presentation/avanco-api.mapper.js";
import { REMESSAS, type RemessasContext } from "../../../remessas/remessas.tokens.js";
import { LogisticsUnitError } from "../../domain/errors/logistics-unit.error.js";
import { LOGISTICS, type LogisticsContext } from "../../logistics.tokens.js";
import {
  advanceWarehouseBody,
  manualShipmentBody,
  productMovementsQuery,
  realignFifoBody,
  transferenciaFilialBody,
  warehouseBalanceQuery,
} from "../schemas/logistics.schemas.js";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_SERVICE_UNAVAILABLE = 503;
const PRISMA_TRANSACTION_TIMEOUT = "P2028";
const INVALID_PAYLOAD = "Payload inválido";

const BAD_REQUEST_ERRORS = [
  RemessaDomainError,
  SaldoFifoInsuficienteError,
  SaldoRemessaInsuficienteError,
  ShipmentError,
  SymbolicShipmentFiscalError,
  BranchTransferError,
  EmitenteFiscalConfigError,
  LogisticsUnitError,
] as const;

/** Erros de emissão viram 400; timeout da transação interativa vira 503 com orientação. */
function toMovementHttpError(error: unknown): unknown {
  if (BAD_REQUEST_ERRORS.some(type => error instanceof type)) {
    return new HttpError(HTTP_BAD_REQUEST, (error as Error).message);
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === PRISMA_TRANSACTION_TIMEOUT) {
    return new HttpError(
      HTTP_SERVICE_UNAVAILABLE,
      "A emissão demorou mais que o esperado. Tente novamente; se persistir, reduza a quantidade ou contate o suporte.",
    );
  }

  return error;
}

async function translatingMovementErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toMovementHttpError(error);
  }
}

@Controller()
@ProtectedApi()
export class MovementController {
  constructor(
    @Inject(LOGISTICS) private readonly logistics: LogisticsContext,
    @Inject(REMESSAS) private readonly remessas: RemessasContext,
  ) {}

  @Post("movimentacoes/remessa")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  emitShipment(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(manualShipmentBody, { invalidMessage: INVALID_PAYLOAD }))
    body: z.infer<typeof manualShipmentBody>,
  ) {
    return translatingMovementErrors(() =>
      this.remessas.emitirRemessaInicial.execute({
        tenantId,
        unidadeDestinoId: body.unidadeDestinoId,
        items: body.items,
      }),
    );
  }

  @Post("movimentacoes/transferencia-filial")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  transferBetweenBranches(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(transferenciaFilialBody, { invalidMessage: INVALID_PAYLOAD }))
    body: z.infer<typeof transferenciaFilialBody>,
  ) {
    return translatingMovementErrors(() =>
      emitBranchTransfer(getDbClient(), { tenantId, filialId: body.filialId, items: body.items }),
    );
  }

  @Post("movimentacoes/avanco-cd")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  async advanceWarehouse(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(advanceWarehouseBody, { invalidMessage: INVALID_PAYLOAD }))
    body: z.infer<typeof advanceWarehouseBody>,
  ) {
    const productId = body.productId.trim();
    await this.assertAdvanceProduct(tenantId, productId, body.productSku);

    return translatingMovementErrors(async () => {
      const result = await this.remessas.emitirAvancoMercadoria.execute({
        tenantId,
        productId,
        productSku: body.productSku,
        quantidade: body.quantidade,
        unidadeOrigemId: body.unidadeOrigemId,
        unidadeDestinoId: body.unidadeDestinoId,
      });

      return mapAvancoMercadoriaParaApi(getDbClient(), result);
    });
  }

  @Get("movimentacoes-produto")
  listProductMovements(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(productMovementsQuery)) query: z.infer<typeof productMovementsQuery>,
  ) {
    return this.logistics.listProductMovements.execute(tenantId, { productId: query.productId, limit: query.limit });
  }

  @Post("movimentacoes/remessa/realign-fifo")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  realignFifo(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(realignFifoBody, { invalidMessage: "SKU obrigatório" }))
    body: z.infer<typeof realignFifoBody>,
  ) {
    return realignRemessaFifoProductIdsBySku(getDbClient(), tenantId, body.productSku);
  }

  @Get("movimentacoes/saldo-cd")
  warehouseBalance(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(warehouseBalanceQuery, { invalidMessage: "productId obrigatório" }))
    query: z.infer<typeof warehouseBalanceQuery>,
  ) {
    return listRemessaBalanceByCd(getDbClient(), tenantId, query.productId, query.productSku);
  }

  /** O avanço exige o produto no cadastro; a mensagem diferencia "tem saldo" de "não existe". */
  private async assertAdvanceProduct(tenantId: string, productId: string, productSku?: string): Promise<void> {
    const resolved = await this.logistics.resolveAdvanceProduct.execute(tenantId, productId, productSku);
    if (resolved) return;

    const hasStock = await this.logistics.hasAdvanceStock.execute(tenantId, productId, productSku);
    const skuHint = productSku?.trim() ? ` (SKU ${productSku.trim()})` : "";
    const message = hasStock
      ? `Há saldo FIFO${skuHint}, mas o produto não está no cadastro desta empresa. Abra Produtos e confira se o SKU está cadastrado com regra fiscal e preço de custo.`
      : `Produto não encontrado nesta empresa${skuHint}. Cadastre em Produtos ou emita nova remessa física para o CD de origem.`;

    throw new HttpError(HTTP_BAD_REQUEST, message);
  }
}
