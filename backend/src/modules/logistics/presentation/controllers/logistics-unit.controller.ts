import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../../nest/http/api-exception.filter.js";
import { orNotFound } from "../../../../nest/http/not-found.js";
import { orUploadError } from "../../../../nest/http/upload-result.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { LogisticsUnitError } from "../../domain/errors/logistics-unit.error.js";
import { LOGISTICS, type LogisticsContext } from "../../logistics.tokens.js";
import { resolveBulkImportPayload } from "../helpers/bulk-import.helper.js";
import { logisticsUnitIdParam, logisticsUnitsListQuery } from "../schemas/logistics.schemas.js";

const HTTP_OK = 200;

/** `LogisticsUnitError` vira 400 no bulk-import e na unidade padrão, como antes. */
const logisticsUnitErrorFilter = new RouteErrorFilter({
  mappings: [{ type: LogisticsUnitError, status: 400 }],
});

type LogisticsUnitIdParam = z.infer<typeof logisticsUnitIdParam>;

function parseAtivaFilter(value: string | undefined): boolean | undefined {
  if (value === "false") return false;
  if (value === "true") return true;

  return undefined;
}

/**
 * Controller HTTP de unidades logísticas Meli Full.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/unidades-logisticas` | ListLogisticsUnitsUseCase |
 * | GET | `/unidades-logisticas/:id` | GetLogisticsUnitByIdUseCase |
 * | POST | `/unidades-logisticas/bulk-import` | BulkImportLogisticsUnitsUseCase (ADMIN) |
 * | PATCH | `/unidades-logisticas/:id/padrao` | SetDefaultLogisticsUnitUseCase |
 */
@Controller("unidades-logisticas")
@ProtectedApi()
export class LogisticsUnitController {
  constructor(@Inject(LOGISTICS) private readonly logistics: LogisticsContext) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(logisticsUnitsListQuery))
    query: z.infer<typeof logisticsUnitsListQuery>,
  ) {
    return this.logistics.listLogisticsUnits.execute(tenantId, {
      ativa: parseAtivaFilter(query.ativa),
      q: query.q,
      cnpj: query.cnpj,
    });
  }

  @Get(":id")
  async get(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(logisticsUnitIdParam)) params: LogisticsUnitIdParam,
  ) {
    return orNotFound(
      await this.logistics.getLogisticsUnitById.execute(tenantId, params.id),
      "Unidade não encontrada",
    );
  }

  @Post("bulk-import")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  @UseFilters(logisticsUnitErrorFilter)
  async bulkImport(@TenantId() tenantId: string, @Req() request: FastifyRequest) {
    const payload = orUploadError(await resolveBulkImportPayload(request));
    const result = await this.logistics.bulkImportLogisticsUnits.execute(
      tenantId,
      payload.rows,
      payload.enrichCep,
    );

    return {
      ...result,
      ...(payload.parseErrors.length > 0 ? { parseErrors: payload.parseErrors } : {}),
    };
  }

  @Patch(":id/padrao")
  @UseFilters(logisticsUnitErrorFilter)
  setDefault(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(logisticsUnitIdParam)) params: LogisticsUnitIdParam,
  ) {
    return this.logistics.setDefaultLogisticsUnit.execute(tenantId, params.id);
  }
}
