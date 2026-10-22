import { Body, Controller, Get, HttpCode, Post, Query, UseFilters } from "@nestjs/common";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { RemessasErrorFilter } from "../errors/remessas-error.filter.js";
import {
  realignFifoBody,
  warehouseBalanceQuery,
  type RealignFifoBody,
  type WarehouseBalanceQuery,
} from "./dtos/stock-fifo.request.dto.js";
import { listRemessaBalanceByCd, realignRemessaFifoProductIdsBySku } from "./remessa-fifo.js";

const HTTP_OK = 200;

/** Saldo FIFO de remessa por CD e realinhamento do produto das linhas por SKU. */
@Controller("movimentacoes")
@ProtectedApi()
@UseFilters(new RemessasErrorFilter())
export class StockFifoController {
  @Get("saldo-cd")
  warehouseBalance(
    @TenantId() tenantId: string,
    @Query(
      new ZodValidationPipe(warehouseBalanceQuery, { invalidMessage: "productId obrigatório" }),
    )
    query: WarehouseBalanceQuery,
  ) {
    return listRemessaBalanceByCd(getDbClient(), tenantId, query.productId, query.productSku);
  }

  @Post("remessa/realign-fifo")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  realignFifo(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(realignFifoBody, { invalidMessage: "SKU obrigatório" }))
    body: RealignFifoBody,
  ) {
    return realignRemessaFifoProductIdsBySku(getDbClient(), tenantId, body.productSku);
  }
}
