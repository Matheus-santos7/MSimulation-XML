import { Body, Controller, HttpCode, Inject, Post, UseFilters } from "@nestjs/common";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { lifecycleErrorFilter } from "../shared/lifecycle-error.filter.js";
import {
  numberInutilizationBody,
  type NumberInutilizationBody,
} from "./dtos/number-inutilization.request.dto.js";
import { NumberInutilizationUseCase } from "./use-cases/number-inutilization.usecase.js";

const HTTP_CREATED = 201;

@Controller("nfes")
@ProtectedApi()
@UseFilters(lifecycleErrorFilter)
export class NumberInutilizationController {
  constructor(
    @Inject(NumberInutilizationUseCase) private readonly inutilization: NumberInutilizationUseCase,
  ) {}

  /** Inutiliza uma faixa de numeração nunca emitida (procInutNFe simulado). */
  @Post("inutilizar")
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  inutilize(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(numberInutilizationBody)) body: NumberInutilizationBody,
  ) {
    return this.inutilization.execute({
      tenantId,
      series: body.serie,
      numberStart: body.numeroIni,
      numberEnd: body.numeroFim,
      justification: body.xJust,
    });
  }
}
