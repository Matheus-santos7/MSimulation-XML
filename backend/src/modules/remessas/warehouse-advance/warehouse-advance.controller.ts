import { Body, Controller, HttpCode, Inject, Post, UseFilters } from "@nestjs/common";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { RemessasErrorFilter } from "../errors/remessas-error.filter.js";
import {
  warehouseAdvanceBody,
  type WarehouseAdvanceBody,
} from "./dtos/warehouse-advance.request.dto.js";
import { WarehouseAdvanceEmitUseCase } from "./use-cases/warehouse-advance-emit.usecase.js";
import { mapAvancoMercadoriaParaApi } from "./warehouse-advance.mapper.js";

const HTTP_OK = 200;

@Controller("movimentacoes")
@ProtectedApi()
@UseFilters(new RemessasErrorFilter())
export class WarehouseAdvanceController {
  constructor(
    @Inject(WarehouseAdvanceEmitUseCase)
    private readonly emitAdvance: WarehouseAdvanceEmitUseCase,
  ) {}

  /** Avanço de mercadoria entre CDs do mesmo marketplace (retorno + remessa simbólicos). */
  @Post("avanco-cd")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  async advance(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(warehouseAdvanceBody, { invalidMessage: "Payload inválido" }))
    body: WarehouseAdvanceBody,
  ) {
    const result = await this.emitAdvance.execute({
      tenantId,
      productId: body.productId.trim(),
      productSku: body.productSku,
      quantidade: body.quantidade,
      unidadeOrigemId: body.unidadeOrigemId,
      unidadeDestinoId: body.unidadeDestinoId,
    });

    return mapAvancoMercadoriaParaApi(getDbClient(), result);
  }
}
