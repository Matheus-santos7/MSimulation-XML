import { Body, Controller, HttpCode, Inject, Post, UseFilters } from "@nestjs/common";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { RemessasErrorFilter } from "../errors/remessas-error.filter.js";
import { shipmentBody, type ShipmentBody } from "./dtos/shipment.request.dto.js";
import { ShipmentEmitUseCase } from "./use-cases/shipment-emit.usecase.js";

const HTTP_OK = 200;

@Controller("movimentacoes")
@ProtectedApi()
@UseFilters(new RemessasErrorFilter())
export class ShipmentController {
  constructor(@Inject(ShipmentEmitUseCase) private readonly emitShipment: ShipmentEmitUseCase) {}

  /** Remessa física seller → CD. O marketplace da nota é o do CD de destino. */
  @Post("remessa")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  emit(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(shipmentBody, { invalidMessage: "Payload inválido" }))
    body: ShipmentBody,
  ) {
    return this.emitShipment.execute({
      tenantId,
      unidadeDestinoId: body.unidadeDestinoId,
      items: body.items,
    });
  }
}
