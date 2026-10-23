import { Controller, Delete, Get, HttpCode, Inject, Param, Query, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { HttpError } from "../../../lib/http/http-error.js";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { orNotFound } from "../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { mapEmitente } from "../../org/index.js";
import { isDownloadRequested, sendFiscalXml } from "../shared/fiscal-xml-response.js";
import { accessKeyParam, type AccessKeyParam } from "../shared/dtos/access-key.request.dto.js";
import { CteService } from "./cte.service.js";

const HTTP_CONFLICT = 409;
const HTTP_NO_CONTENT = 204;
const CTE_NOT_FOUND = "CT-e não encontrado";

/** Emitente do tenant e consulta de CT-e (lista, detalhe, XML, exclusão lógica ADMIN). */
@Controller()
@ProtectedApi()
export class CteController {
  constructor(@Inject(CteService) private readonly ctes: CteService) {}

  @Get("emitente")
  async emitente(@TenantId() tenantId: string) {
    const tenant = await getDbClient().tenant.findUniqueOrThrow({ where: { id: tenantId } });

    return mapEmitente(tenant);
  }

  @Get("ctes")
  list(@TenantId() tenantId: string) {
    return this.ctes.list(tenantId);
  }

  @Get("ctes/:chave/xml")
  async xml(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
    @Query() query: { download?: string },
    @Res() reply: FastifyReply,
  ) {
    const result = await this.ctes.xml(tenantId, params.chave);
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
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
  ) {
    return orNotFound(await this.ctes.get(tenantId, params.chave), CTE_NOT_FOUND);
  }

  @Delete("ctes/:chave")
  @AdminOnly()
  @HttpCode(HTTP_NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
  ) {
    orNotFound(await this.ctes.softDelete(params.chave, tenantId), CTE_NOT_FOUND);
  }

  /** Sem XML: 404 se o CT-e não existe; 409 se existe mas os dados fiscais estão incompletos. */
  private async throwMissingXml(tenantId: string, chave: string): Promise<never> {
    orNotFound(await this.ctes.exists(tenantId, chave), CTE_NOT_FOUND);

    throw new HttpError(HTTP_CONFLICT, "XML do CT-e indisponível. Dados fiscais incompletos.");
  }
}
