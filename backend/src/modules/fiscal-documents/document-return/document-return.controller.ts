import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseFilters } from "@nestjs/common";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { accessKeyParam, type AccessKeyParam } from "../shared/dtos/access-key.request.dto.js";
import { lifecycleErrorFilter } from "../shared/lifecycle-error.filter.js";
import { saleReturnBody, type SaleReturnBody } from "./dtos/document-return.request.dto.js";
import { PhysicalReturnUseCase } from "./use-cases/physical-return.usecase.js";
import { SaleReturnUseCase } from "./use-cases/sale-return.usecase.js";

const HTTP_CREATED = 201;

/** Devolução de venda (integral ou parcial), insucesso de entrega e retorno físico da remessa. */
@Controller("nfes")
@ProtectedApi()
@UseFilters(lifecycleErrorFilter)
export class DocumentReturnController {
  constructor(
    @Inject(SaleReturnUseCase) private readonly saleReturn: SaleReturnUseCase,
    @Inject(PhysicalReturnUseCase) private readonly physicalReturn: PhysicalReturnUseCase,
  ) {}

  /** Linhas da venda com quantidades vendidas, já devolvidas e disponíveis. */
  @Get(":chave/devolucao")
  @AdminOnly()
  returnableItems(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
  ) {
    return this.saleReturn.getReturnableItems({ tenantId, saleNfeKey: params.chave });
  }

  @Post(":chave/devolucao")
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  processReturn(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
    @Body(new ZodValidationPipe(saleReturnBody)) body: SaleReturnBody,
  ) {
    return this.saleReturn.execute({
      tenantId,
      saleNfeKey: params.chave,
      returnTipo: "DEVOLUCAO",
      itens: body.itens,
    });
  }

  @Post(":chave/insulcesso")
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  failedDelivery(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
  ) {
    return this.saleReturn.execute({
      tenantId,
      saleNfeKey: params.chave,
      returnTipo: "INSULCESSO_DE_ENTREGA",
    });
  }

  @Post(":chave/retorno-fisico")
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  physicalReturnOfShipment(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
  ) {
    return this.physicalReturn.execute({ tenantId, remessaNfeKey: params.chave });
  }
}
