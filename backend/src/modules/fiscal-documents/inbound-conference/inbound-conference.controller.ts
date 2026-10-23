import { Body, Controller, Get, Inject, Param, Post, Res, UseFilters } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { accessKeyParam, type AccessKeyParam } from "../shared/dtos/access-key.request.dto.js";
import { lifecycleErrorFilter } from "../shared/lifecycle-error.filter.js";
import {
  inboundConferenceBody,
  type InboundConferenceBody,
} from "./dtos/inbound-conference.request.dto.js";
import { InboundConferenceUseCase } from "./use-cases/inbound-conference.usecase.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;

/** Conferência de entrada no CD: quantidade esperada e notas de diferença (POSITIVE/NEGATIVE). */
@Controller("nfes")
@ProtectedApi()
@UseFilters(lifecycleErrorFilter)
export class InboundConferenceController {
  constructor(
    @Inject(InboundConferenceUseCase) private readonly conference: InboundConferenceUseCase,
  ) {}

  @Get(":chave/conferencia")
  @AdminOnly()
  expected(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
  ) {
    return this.conference.getExpected({ tenantId, remessaNfeKey: params.chave });
  }

  /** 201 quando a conferência emite nota de ajuste; 200 quando não havia divergência (`noop`). */
  @Post(":chave/conferencia")
  @AdminOnly()
  async confer(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
    @Body(new ZodValidationPipe(inboundConferenceBody)) body: InboundConferenceBody,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.conference.execute({
      tenantId,
      remessaNfeKey: params.chave,
      receivedQty: body.receivedQty,
      positiveCfopOverride: body.positiveCfopOverride,
      negativeCfopOverride: body.negativeCfopOverride,
    });
    reply.status(result.noop ? HTTP_OK : HTTP_CREATED);

    return result;
  }
}
