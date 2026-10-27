import { Body, Controller, HttpCode, Inject, Param, Post, UseFilters } from "@nestjs/common";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { accessKeyParam, type AccessKeyParam } from "../shared/dtos/access-key.request.dto.js";
import { lifecycleErrorFilter } from "../shared/lifecycle-error.filter.js";
import { cancellationBody, type CancellationBody } from "./dtos/cancellation.request.dto.js";
import { CancellationUseCase } from "./use-cases/cancellation.usecase.js";

const HTTP_OK = 200;

@Controller("nfes")
@ProtectedApi()
@UseFilters(lifecycleErrorFilter)
export class CancellationController {
  constructor(@Inject(CancellationUseCase) private readonly cancellation: CancellationUseCase) {}

  /** Cancela a venda autorizada, o retorno simbólico da cadeia e o CT-e (evento 110111). */
  @Post(":chave/cancelamento")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  cancel(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
    @Body(new ZodValidationPipe(cancellationBody)) body: CancellationBody,
  ) {
    return this.cancellation.execute({
      tenantId,
      nfeKey: params.chave,
      justification: body.xJust,
    });
  }
}
