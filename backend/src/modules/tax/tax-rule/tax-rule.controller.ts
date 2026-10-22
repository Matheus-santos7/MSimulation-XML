import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  UseFilters,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { AdminOnly, ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../nest/http/api-exception.filter.js";
import { orUploadError } from "../../../nest/http/upload-result.js";
import { ZodValidationPipe } from "../../../nest/http/zod-validation.pipe.js";
import { TaxRuleError } from "../errors/tax.errors.js";
import {
  bulkUpsertTaxRulesRequestSchema,
  type BulkUpsertTaxRulesRequestDTO,
} from "./dtos/bulk-upsert-tax-rules.request.dto.js";
import { TaxRuleService } from "./tax-rule.service.js";
import { resolveTaxRuleSpreadsheetUpload } from "./tax-rule-upload.js";

const HTTP_OK = 200;

/** `TaxRuleError` vira 400 só no import e no delete; no bulk-upsert segue o contrato global. */
const taxRuleErrorFilter = new RouteErrorFilter({
  mappings: [{ type: TaxRuleError, status: 400 }],
});

/**
 * Regras tributárias.
 *
 * | Método | Rota | Service |
 * |--------|------|---------|
 * | GET | `/tax-rules/catalog` | catalog |
 * | GET | `/tax-rules` | list |
 * | POST | `/tax-rules/bulk-upsert` | bulkUpsert (ADMIN) |
 * | POST | `/tax-rules/import-spreadsheet` | importSpreadsheet (ADMIN) |
 * | DELETE | `/tax-rules` | deleteAll (ADMIN) |
 */
@Controller("tax-rules")
@ApiTags("tax-rules")
@ProtectedApi()
export class TaxRuleController {
  constructor(@Inject(TaxRuleService) private readonly taxRuleService: TaxRuleService) {}

  @Get("catalog")
  catalog(@TenantId() tenantId: string) {
    return this.taxRuleService.catalog(tenantId);
  }

  @Get()
  list(@TenantId() tenantId: string) {
    return this.taxRuleService.list(tenantId);
  }

  @Post("bulk-upsert")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  bulkUpsert(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(bulkUpsertTaxRulesRequestSchema))
    body: BulkUpsertTaxRulesRequestDTO,
  ) {
    return this.taxRuleService.bulkUpsert(tenantId, body.rows);
  }

  @Post("import-spreadsheet")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  @UseFilters(taxRuleErrorFilter)
  async importSpreadsheet(@TenantId() tenantId: string, @Req() request: FastifyRequest) {
    const upload = orUploadError(await resolveTaxRuleSpreadsheetUpload(request));

    return this.taxRuleService.importSpreadsheet(tenantId, upload.buffer);
  }

  @Delete()
  @AdminOnly()
  @UseFilters(taxRuleErrorFilter)
  deleteAll(@TenantId() tenantId: string) {
    return this.taxRuleService.deleteAll(tenantId);
  }
}
