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
import { Marketplace } from "@msimulation-xml/fiscal-core";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../nest/http/api-exception.filter.js";
import { orUploadError } from "../../../nest/http/upload-result.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { LogisticsUnitError } from "../errors/logistics.errors.js";
import { resolveBulkImportPayload } from "./bulk-import-upload.js";
import {
  logisticsUnitsListQuery,
  type ListLogisticsUnitsQueryDTO,
} from "./dtos/list-logistics-units.query.dto.js";
import {
  logisticsUnitIdParam,
  type LogisticsUnitParamsDTO,
} from "./dtos/logistics-unit.params.dto.js";
import { LogisticsUnitService } from "./logistics-unit.service.js";

const HTTP_OK = 200;

/** `LogisticsUnitError` vira 400 no bulk-import e na unidade padrão. */
const logisticsUnitErrorFilter = new RouteErrorFilter({
  mappings: [{ type: LogisticsUnitError, status: 400 }],
});

function parseAtivaFilter(value: string | undefined): boolean | undefined {
  if (value === "false") return false;
  if (value === "true") return true;

  return undefined;
}

/**
 * CDs de fulfillment (unidades logísticas).
 *
 * | Método | Rota | Service |
 * |--------|------|---------|
 * | GET | `/unidades-logisticas` | list (`?marketplace=`, `?ativa=`, `?q=`, `?cnpj=`) |
 * | GET | `/unidades-logisticas/:id` | get |
 * | POST | `/unidades-logisticas/bulk-import` | bulkImport: planilha de CDs do Mercado Livre (ADMIN) |
 * | PATCH | `/unidades-logisticas/:id/padrao` | setDefault |
 */
@Controller("unidades-logisticas")
@ApiTags("unidades-logisticas")
@ProtectedApi()
export class LogisticsUnitController {
  constructor(@Inject(LogisticsUnitService) private readonly units: LogisticsUnitService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(logisticsUnitsListQuery)) query: ListLogisticsUnitsQueryDTO,
  ) {
    return this.units.list(tenantId, {
      ativa: parseAtivaFilter(query.ativa),
      q: query.q,
      cnpj: query.cnpj,
      marketplace: query.marketplace,
    });
  }

  @Get(":id")
  get(
    @TenantId() tenantId: string,
    @Param(new ZodValidationPipe(logisticsUnitIdParam)) params: LogisticsUnitParamsDTO,
  ) {
    return this.units.get(tenantId, params.id);
  }

  /** A planilha aceita é o export de CDs do Mercado Livre (adapter `adapters/mercado-livre`). */
  @Post("bulk-import")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  @UseFilters(logisticsUnitErrorFilter)
  async bulkImport(@TenantId() tenantId: string, @Req() request: FastifyRequest) {
    const payload = orUploadError(await resolveBulkImportPayload(request));
    const result = await this.units.bulkImport(
      tenantId,
      Marketplace.MERCADO_LIVRE,
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
    @Param(new ZodValidationPipe(logisticsUnitIdParam)) params: LogisticsUnitParamsDTO,
  ) {
    return this.units.setDefault(tenantId, params.id);
  }
}
