import { Controller, Delete, Get, HttpCode, Inject, Param, Query, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { HttpError } from "../../../lib/http/http-error.js";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { orNotFound } from "../../../nest/http/not-found.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { isDownloadRequested, sendFiscalXml } from "../shared/fiscal-xml-response.js";
import { accessKeyParam, type AccessKeyParam } from "../shared/dtos/access-key.request.dto.js";
import { listNfesQuery, type ListNfesQuery, type NfeXmlQuery } from "./dtos/nfe.request.dto.js";
import { NfeService, type NfeXmlDocument } from "./nfe.service.js";

const HTTP_CONFLICT = 409;
const HTTP_NO_CONTENT = 204;
const NFE_NOT_FOUND = "NF-e não encontrada";

/** `?doc=evento` (ou `cancelamento`) pede o XML do evento de cancelamento. */
function requestedNfeDocument(query: NfeXmlQuery): NfeXmlDocument | undefined {
  return query.doc === "evento" || query.doc === "cancelamento" ? "evento" : undefined;
}

/** Consulta de NF-e: GET /nfes (`?marketplace=`), detalhe, XML e exclusão lógica (ADMIN). */
@Controller("nfes")
@ProtectedApi()
export class NfeController {
  constructor(@Inject(NfeService) private readonly nfes: NfeService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(listNfesQuery)) query: ListNfesQuery,
  ) {
    return this.nfes.list(tenantId, { marketplace: query.marketplace });
  }

  @Get(":chave/xml")
  async xml(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
    @Query() query: NfeXmlQuery,
    @Res() reply: FastifyReply,
  ) {
    const doc = requestedNfeDocument(query);
    const result = await this.nfes.xml(tenantId, params.chave, doc);
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
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
  ) {
    return orNotFound(await this.nfes.get(tenantId, params.chave), NFE_NOT_FOUND);
  }

  @Delete(":chave")
  @AdminOnly()
  @HttpCode(HTTP_NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(accessKeyParam)) params: AccessKeyParam,
  ) {
    orNotFound(await this.nfes.softDelete(params.chave, tenantId), NFE_NOT_FOUND);
  }

  /** Sem XML: 404 se o evento ou a NF-e não existem; 409 se a NF-e existe mas o tipo não tem XML. */
  private async throwMissingXml(
    tenantId: string,
    chave: string,
    doc: NfeXmlDocument | undefined,
  ): Promise<never> {
    orNotFound(doc !== "evento", "Evento de cancelamento não encontrado para esta NF-e");
    const tipo = orNotFound(await this.nfes.tipoWhenXmlMissing(tenantId, chave), NFE_NOT_FOUND);

    throw new HttpError(HTTP_CONFLICT, `XML indisponível para NF-e tipo ${tipo}.`);
  }
}
