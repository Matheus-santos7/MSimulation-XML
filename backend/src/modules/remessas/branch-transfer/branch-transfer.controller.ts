import { Body, Controller, HttpCode, Inject, Post, UseFilters } from "@nestjs/common";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { RemessasErrorFilter } from "../errors/remessas-error.filter.js";
import { branchTransferBody, type BranchTransferBody } from "./dtos/branch-transfer.request.dto.js";
import { BranchTransferEmitUseCase } from "./use-cases/branch-transfer-emit.usecase.js";

const HTTP_OK = 200;

@Controller("movimentacoes")
@ProtectedApi()
@UseFilters(new RemessasErrorFilter())
export class BranchTransferController {
  constructor(
    @Inject(BranchTransferEmitUseCase) private readonly emitTransfer: BranchTransferEmitUseCase,
  ) {}

  /** Transferência matriz → filial e remessa automática da filial ao CD padrão. */
  @Post("transferencia-filial")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  transfer(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(branchTransferBody, { invalidMessage: "Payload inválido" }))
    body: BranchTransferBody,
  ) {
    return this.emitTransfer.execute({ tenantId, filialId: body.filialId, items: body.items });
  }
}
