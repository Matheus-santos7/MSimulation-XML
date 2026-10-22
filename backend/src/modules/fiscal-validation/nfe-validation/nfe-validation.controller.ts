import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import {
  nfeValidationBackfillBody,
  type NfeValidationBackfillBody,
} from "./dtos/nfe-validation.request.dto.js";
import { NfeValidationBackfillUseCase } from "./use-cases/nfe-validation-backfill.usecase.js";

const HTTP_OK = 200;

@Controller("fiscal-validation")
@ProtectedApi()
export class NfeValidationController {
  constructor(
    @Inject(NfeValidationBackfillUseCase) private readonly backfill: NfeValidationBackfillUseCase,
  ) {}

  /** Revalida as NF-es pendentes do tenant no validador MCP. */
  @Post("backfill")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  revalidatePending(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(nfeValidationBackfillBody)) body: NfeValidationBackfillBody,
  ) {
    return this.backfill.execute(getDbClient(), tenantId, { limit: body.limit });
  }
}
