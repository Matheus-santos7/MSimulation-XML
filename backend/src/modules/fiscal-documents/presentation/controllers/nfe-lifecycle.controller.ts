import { Body, Controller, Get, HttpCode, Inject, Param, Post, Res, UseFilters } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { z } from "zod";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../../nest/http/api-exception.filter.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { DocumentCancellationError } from "../../domain/errors/document-cancellation.error.js";
import { DocumentReturnError } from "../../domain/errors/document-return.error.js";
import { NumberInutilizationError } from "../../domain/errors/number-inutilization.error.js";
import { FISCAL_DOCUMENTS, type FiscalDocumentsContext } from "../../fiscal-documents.tokens.js";
import {
  cancelDocumentBodySchema,
  inboundConferenceBodySchema,
  inutilizeNumberBodySchema,
  nfeAccessKeyParamSchema,
  processReturnBodySchema,
} from "../schemas/fiscal-document.schemas.js";

const HTTP_OK = 200;
const HTTP_CREATED = 201;

/** Erros de domínio com `.status` próprio (inutilização, devolução, cancelamento). */
const NFE_LIFECYCLE_ERRORS = [NumberInutilizationError, DocumentReturnError, DocumentCancellationError] as const;

type AccessKeyParam = z.infer<typeof nfeAccessKeyParamSchema>;

/**
 * Ciclo de vida da NF-e: inutilização, devolução, insucesso de entrega, retorno físico,
 * conferência de entrada e cancelamento. Todas as rotas são ADMIN (`@AdminOnly()` por
 * método: guards de método rodam depois do JWT do controller).
 * O corpo vazio vira `{}` antes da validação, como no controller Fastify.
 */
@Controller("nfes")
@ProtectedApi()
@UseFilters(new RouteErrorFilter({ statusErrors: NFE_LIFECYCLE_ERRORS }))
export class NfeLifecycleController {
  constructor(@Inject(FISCAL_DOCUMENTS) private readonly fiscalDocuments: FiscalDocumentsContext) {}

  @Post("inutilizar")
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  inutilize(@TenantId() tenantId: string, @Body() rawBody: unknown) {
    const body = inutilizeNumberBodySchema.parse(rawBody ?? {});

    return this.fiscalDocuments.inutilizeNumber.execute({
      tenantId,
      series: body.serie,
      numberStart: body.numeroIni,
      numberEnd: body.numeroFim,
      justification: body.xJust,
    });
  }

  @Get(":chave/devolucao")
  @AdminOnly()
  returnableItems(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
  ) {
    return this.fiscalDocuments.processReturn.getReturnableItems({ tenantId, saleNfeKey: params.chave });
  }

  @Post(":chave/devolucao")
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  processReturn(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
    @Body() rawBody: unknown,
  ) {
    const body = processReturnBodySchema.parse(rawBody ?? {});

    return this.fiscalDocuments.processReturn.execute({
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
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
  ) {
    return this.fiscalDocuments.processReturn.execute({
      tenantId,
      saleNfeKey: params.chave,
      returnTipo: "INSULCESSO_DE_ENTREGA",
    });
  }

  @Post(":chave/retorno-fisico")
  @AdminOnly()
  @HttpCode(HTTP_CREATED)
  physicalReturn(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
  ) {
    return this.fiscalDocuments.processPhysicalReturn.execute({ tenantId, remessaNfeKey: params.chave });
  }

  @Get(":chave/conferencia")
  @AdminOnly()
  expectedConference(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
  ) {
    return this.fiscalDocuments.processInboundConference.getExpected({ tenantId, remessaNfeKey: params.chave });
  }

  /** 201 quando a conferência emite nota de ajuste; 200 quando não havia divergência (`noop`). */
  @Post(":chave/conferencia")
  @AdminOnly()
  async inboundConference(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
    @Body() rawBody: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const body = inboundConferenceBodySchema.parse(rawBody ?? {});
    const result = await this.fiscalDocuments.processInboundConference.execute({
      tenantId,
      remessaNfeKey: params.chave,
      receivedQty: body.receivedQty,
      positiveCfopOverride: body.positiveCfopOverride,
      negativeCfopOverride: body.negativeCfopOverride,
    });
    reply.status(result.noop ? HTTP_OK : HTTP_CREATED);

    return result;
  }

  @Post(":chave/cancelamento")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  cancel(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
    @Body() rawBody: unknown,
  ) {
    const body = cancelDocumentBodySchema.parse(rawBody ?? {});

    return this.fiscalDocuments.cancelDocument.execute({ tenantId, nfeKey: params.chave, justification: body.xJust });
  }
}
