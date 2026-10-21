import { Controller, Delete, Get, HttpCode, Inject, Param, Query, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { z } from "zod";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { HttpError } from "../../../../lib/http/http-error.js";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { orNotFound } from "../../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { mapEmitente } from "../../../org/infrastructure/fiscal/tenant-emitente.mapper.js";
import { FISCAL_DOCUMENTS, type FiscalDocumentsContext } from "../../fiscal-documents.tokens.js";
import { isDownloadRequested, sendFiscalXml } from "../helpers/fiscal-xml-response.js";
import { nfeAccessKeyParamSchema } from "../schemas/fiscal-document.schemas.js";

const HTTP_CONFLICT = 409;
const HTTP_NO_CONTENT = 204;
const CTE_NOT_FOUND = "CT-e não encontrado";

type AccessKeyParam = z.infer<typeof nfeAccessKeyParamSchema>;

/**
 * Emitente e consulta de CT-e.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/emitente` | dados do emitente do tenant |
 * | GET | `/ctes` | ListCtesUseCase |
 * | GET | `/ctes/:chave/xml` | GetCteXmlUseCase |
 * | GET | `/ctes/:chave` | GetCteByKeyUseCase |
 * | DELETE | `/ctes/:chave` | SoftDeleteCteUseCase (ADMIN) |
 */
@Controller()
@ProtectedApi()
export class CteController {
  constructor(@Inject(FISCAL_DOCUMENTS) private readonly fiscalDocuments: FiscalDocumentsContext) {}

  @Get("emitente")
  async emitente(@TenantId() tenantId: string) {
    const tenant = await getDbClient().tenant.findUniqueOrThrow({ where: { id: tenantId } });

    return mapEmitente(tenant);
  }

  @Get("ctes")
  list(@TenantId() tenantId: string) {
    return this.fiscalDocuments.listCtes.execute(tenantId);
  }

  @Get("ctes/:chave/xml")
  async xml(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
    @Query() query: { download?: string },
    @Res() reply: FastifyReply,
  ) {
    const result = await this.fiscalDocuments.getCteXml.execute(tenantId, params.chave);
    if (!result) {
      return this.throwMissingXml(tenantId, params.chave);
    }

    return sendFiscalXml(reply, {
      xml: result.xml,
      filename: result.filename,
      download: isDownloadRequested(query),
      headers: { "X-CTe-Xml-Source": result.source },
    });
  }

  @Get("ctes/:chave")
  async get(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
  ) {
    return orNotFound(
      await this.fiscalDocuments.getCteByKey.execute(tenantId, params.chave),
      CTE_NOT_FOUND,
    );
  }

  @Delete("ctes/:chave")
  @AdminOnly()
  @HttpCode(HTTP_NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(nfeAccessKeyParamSchema)) params: AccessKeyParam,
  ) {
    orNotFound(
      await this.fiscalDocuments.softDeleteCte.execute(params.chave, tenantId),
      CTE_NOT_FOUND,
    );
  }

  /** Sem XML: 404 se o CT-e não existe; 409 se existe mas os dados fiscais estão incompletos. */
  private async throwMissingXml(tenantId: string, chave: string): Promise<never> {
    orNotFound(await this.fiscalDocuments.getCteXml.cteExists(tenantId, chave), CTE_NOT_FOUND);

    throw new HttpError(HTTP_CONFLICT, "XML do CT-e indisponível. Dados fiscais incompletos.");
  }
}
