import { Controller, Get, Inject } from "@nestjs/common";
import { ProtectedApi } from "../../../nest/api-access.decorators.js";
import { TenantId } from "../../../nest/auth/request-params.js";
import { ValidationInsightsUseCase } from "./use-cases/validation-insights.usecase.js";

@Controller("fiscal-validation")
@ProtectedApi()
export class ValidationInsightsController {
  constructor(
    @Inject(ValidationInsightsUseCase) private readonly insights: ValidationInsightsUseCase,
  ) {}

  @Get("insights")
  get(@TenantId() tenantId: string) {
    return this.insights.execute(tenantId);
  }
}
