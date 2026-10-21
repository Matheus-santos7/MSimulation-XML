import { Body, Controller, Get, HttpCode, Inject, Post } from "@nestjs/common";
import { z } from "zod";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
import { AdminOnly, ProtectedApi } from "../../../../nest/api-access.decorators.js";
import { TenantId } from "../../../../nest/auth/request-params.js";
import { FISCAL_VALIDATION, type FiscalValidationContext } from "../../fiscal-validation.tokens.js";

const HTTP_OK = 200;

const backfillValidationBodySchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});

/**
 * Validação fiscal via MCP (status do validador, insights e backfill).
 *
 * | Método | Rota | Use case |
 * |--------|------|----------|
 * | GET | `/fiscal-validation/insights` | GetValidationInsightsUseCase |
 * | GET | `/fiscal-validation/status` | GetValidatorHealthUseCase |
 * | POST | `/fiscal-validation/backfill` | BackfillPendingNfeValidationUseCase (ADMIN) |
 */
@Controller("fiscal-validation")
@ProtectedApi()
export class FiscalValidationController {
  constructor(@Inject(FISCAL_VALIDATION) private readonly fiscalValidation: FiscalValidationContext) {}

  @Get("insights")
  insights(@TenantId() tenantId: string) {
    return this.fiscalValidation.createGetValidationInsights(getDbClient()).execute(tenantId);
  }

  @Get("status")
  status() {
    return this.fiscalValidation.getValidatorHealth.execute();
  }

  @Post("backfill")
  @AdminOnly()
  @HttpCode(HTTP_OK)
  backfill(@TenantId() tenantId: string, @Body() rawBody: unknown) {
    // Corpo opcional: requisição sem corpo usa o limite padrão do use case.
    const body = backfillValidationBodySchema.parse(rawBody ?? {});
    const db = getDbClient();

    return this.fiscalValidation.createBackfillPendingNfeValidation(db).execute(db, tenantId, { limit: body.limit });
  }
}
