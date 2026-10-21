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
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { RouteErrorFilter } from "../../../../nest/http/api-exception.filter.js";
import { orUploadError } from "../../../../nest/http/upload-result.js";
import { ZodValidationPipe } from "../../../../nest/http/zod-validation.pipe.js";
import { TaxRuleError } from "../../domain/errors/tax-rule.error.js";
import { TAX, type TaxContext } from "../../tax.tokens.js";
import { resolveTaxRuleSpreadsheetUpload } from "../helpers/tax-rule-import.helper.js";
import { taxRulesBulkBodySchema } from "../schemas/tax.schemas.js";

const HTTP_OK = 200;

/** `TaxRuleError` vira 400 só no import e no delete; no bulk-upsert segue o handler global, como antes. */
const taxRuleErrorFilter = new RouteErrorFilter({
  mappings: [{ type: TaxRuleError, status: 400 }],
});

/**
 * Controller HTTP de regras tributárias.
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/tax-rules/catalog` | GetTaxRuleCatalogUseCase |
 * | GET | `/tax-rules` | GetTaxRulesUseCase |
 * | POST | `/tax-rules/bulk-upsert` | BulkUpsertTaxRulesUseCase (ADMIN) |
 * | POST | `/tax-rules/import-spreadsheet` | ImportTaxRulesSpreadsheetUseCase (ADMIN) |
 * | DELETE | `/tax-rules` | DeleteAllTaxRulesUseCase (ADMIN) |
 */
@Controller("tax-rules")
@ProtectedApi()
export class TaxRuleController {
  constructor(@Inject(TAX) private readonly tax: TaxContext) {}

  @Get("catalog")
  catalog(@TenantId() tenantId: string) {
    return this.tax.getTaxRuleCatalog.execute(tenantId);
  }

  @Get()
  list(@TenantId() tenantId: string) {
    return this.tax.getTaxRules.execute(tenantId);
  }

  @Post("bulk-upsert")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  bulkUpsert(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(taxRulesBulkBodySchema))
    body: z.infer<typeof taxRulesBulkBodySchema>,
  ) {
    return this.tax.bulkUpsertTaxRules.execute(tenantId, body.rows);
  }

  @Post("import-spreadsheet")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  @UseFilters(taxRuleErrorFilter)
  async importSpreadsheet(@TenantId() tenantId: string, @Req() request: FastifyRequest) {
    const upload = orUploadError(await resolveTaxRuleSpreadsheetUpload(request));

    return this.tax.importTaxRulesSpreadsheet.execute(tenantId, upload.buffer);
  }

  @Delete()
  @AdminOnly()
  @UseFilters(taxRuleErrorFilter)
  deleteAll(@TenantId() tenantId: string) {
    return this.tax.deleteAllTaxRules.execute(tenantId);
  }
}
