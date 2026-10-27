import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { z } from "zod";
import { ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { productMovementsQuery } from "./dtos/product-movement.request.dto.js";
import { ProductMovementService } from "./product-movement.service.js";

/**
 * Histórico de movimentações de produto entre CDs. As rotas de emissão (`/movimentacoes/*`)
 * ficam no módulo remessas.
 */
@Controller()
@ProtectedApi()
export class ProductMovementController {
  constructor(@Inject(ProductMovementService) private readonly movements: ProductMovementService) {}

  @Get("movimentacoes-produto")
  listProductMovements(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(productMovementsQuery))
    query: z.infer<typeof productMovementsQuery>,
  ) {
    return this.movements.list(tenantId, { productId: query.productId, limit: query.limit });
  }
}
