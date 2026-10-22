import { Controller, Get, Inject } from "@nestjs/common";
import { ProtectedApi } from "../../../nest/api-access.decorators.js";
import { FiscalValidatorProvider } from "../providers/fiscal-validator/fiscal-validator.provider.js";
import type { ValidatorHealth } from "./validator-status.types.js";

/** Alcance do validador MCP para o diagnóstico na tela de administração. */
@Controller("fiscal-validation")
@ProtectedApi()
export class ValidatorStatusController {
  constructor(
    @Inject(FiscalValidatorProvider) private readonly validator: FiscalValidatorProvider,
  ) {}

  @Get("status")
  status(): Promise<ValidatorHealth> {
    return this.validator.health();
  }
}
