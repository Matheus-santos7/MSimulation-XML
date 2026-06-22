import type { McpFiscalValidatorPort } from "../../domain/ports/mcp-fiscal-validator.port.js";
import type { FiscalValidatorRuntimeConfig } from "../../domain/services/resolve-nfe-validation.service.js";
import { resolveNfeValidation } from "../../domain/services/resolve-nfe-validation.service.js";
import type { NfeValidationOutcome } from "../../domain/entities/nfe-validation-outcome.entity.js";

/** Validates NF-e XML via MCP and returns domain outcome. */
export class ValidateNfeXmlUseCase {
  constructor(
    private readonly validator: McpFiscalValidatorPort,
    private readonly config: FiscalValidatorRuntimeConfig,
  ) {}

  async execute(xml: string): Promise<NfeValidationOutcome> {
    return resolveNfeValidation(this.validator, xml, this.config);
  }
}
