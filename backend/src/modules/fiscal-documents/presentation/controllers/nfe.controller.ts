import { Controller, Delete, Get, HttpCode, Inject, Param, Query, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { z } from "zod";
import { HttpError } from "../../../../lib/http/http-error.js";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { orNotFound } from "../../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { FISCAL_DOCUMENTS, type FiscalDocumentsContext } from "../../fiscal-documents.tokens.js";
import { isDownloadRequested, sendFiscalXml } from "../helpers/fiscal-xml-response.js";
import { nfeAccessKeyParamSchema } from "../schemas/fiscal-document.schemas.js";

const HTTP_CONFLICT = 409;
const HTTP_NO_CONTENT = 204;
const NFE_NOT_FOUND = "NF-e não encontrada";

type AccessKeyParam = z.infer<typeof nfeAccessKeyParamSchema>;
type NfeXmlQuery = { download?: string; doc?: string };

/** `?doc=evento` (ou `cancelamento`) pede o XML do evento de cancelamento. */
function requestedNfeDocument(query: NfeXmlQuery): "evento" | undefined {
  return query.doc === "evento" || query.doc === "cancelamento" ? "evento" : undefined;
}

/**
 * Consulta de NF-e.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/nfes` | ListNfesUseCase |
 * | GET | `/nfes/:chave/xml` | GetNfeXmlUseCase |
 * | GET | `/nfes/:chave` | GetNfeByKeyUseCase |
 * | DELETE | `/nfes/:chave` | SoftDeleteNfeUseCase (ADMIN) |
 */
@Controller("nfes")
@ProtectedApi()
export class NfeController {
  constructor(@Inject(FISCAL_DOCUMENTS) private readonly fiscalDocuments: FiscalDocumentsContext) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.fiscalDocuments.listNfes.execute(tenantId);
  }

  @Get(":chave/xml")
  async xml(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
    @Query() query: NfeXmlQuery,
    @Res() reply: FastifyReply,
  ) {
    const doc = requestedNfeDocument(query);
    const result = await this.fiscalDocuments.getNfeXml.execute(tenantId, params.chave, { doc });
    if (!result) {
      return this.throwMissingXml(tenantId, params.chave, doc);
    }

    return sendFiscalXml(reply, {
      xml: result.xml,
      filename: result.filename,
      download: isDownloadRequested(query),
      headers: { "X-NFe-Xml-Source": result.source },
    });
  }

  @Get(":chave")
  async get(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
  ) {
    return orNotFound(
      await this.fiscalDocuments.getNfeByKey.execute(tenantId, params.chave),
      NFE_NOT_FOUND,
    );
  }

  @Delete(":chave")
  @AdminOnly()
  @HttpCode(HTTP_NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
  ) {
    orNotFound(
      await this.fiscalDocuments.softDeleteNfe.execute(params.chave, tenantId),
      NFE_NOT_FOUND,
    );
  }

  /** Sem XML: 404 se o evento ou a NF-e não existem; 409 se a NF-e existe mas o tipo não tem XML. */
  private async throwMissingXml(
    tenantId: string,
    chave: string,
    doc: "evento" | undefined,
  ): Promise<never> {
    orNotFound(doc !== "evento", "Evento de cancelamento não encontrado para esta NF-e");
    const tipo = orNotFound(
      await this.fiscalDocuments.getNfeXml.getTipoWhenMissing(tenantId, chave),
      NFE_NOT_FOUND,
    );

    throw new HttpError(HTTP_CONFLICT, `XML indisponível para NF-e tipo ${tipo}.`);
  }
}
