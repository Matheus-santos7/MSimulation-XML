import {
  VALIDATION_DISABLED_MESSAGE,
  validatorUnavailableMessage,
} from "../constants/operational-validation-messages.js";
import type { NfeMcpAudit } from "../entities/nfe-mcp-audit.entity.js";
import type { NfeValidationOutcome } from "../entities/nfe-validation-outcome.entity.js";
import type { McpFiscalValidatorPort } from "../ports/mcp-fiscal-validator.port.js";

export type FiscalValidatorRuntimeConfig = {
  enabled: boolean;
};

function outcomeFromAudit(audit: NfeMcpAudit): NfeValidationOutcome {
  return {
    status: audit.valida ? "APPROVED" : "REJECTED",
    message: audit.resumo.length > 0 ? audit.resumo : null,
    errors: audit.erros.length > 0 ? audit.erros : null,
    audit,
  };
}

/**
 * Orchestrates MCP validation and maps to domain outcome.
 * Never throws — transport errors become PENDING with operational message.
 */
export async function resolveNfeValidation(
  validator: McpFiscalValidatorPort,
  xml: string,
  config: FiscalValidatorRuntimeConfig,
): Promise<NfeValidationOutcome> {
  if (!config.enabled) {
    return {
      status: "PENDING",
      message: VALIDATION_DISABLED_MESSAGE,
      errors: null,
      audit: null,
    };
  }

  try {
    const audit = await validator.validateNfe(xml);
    return outcomeFromAudit(audit);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      status: "PENDING",
      message: validatorUnavailableMessage(detail),
      errors: null,
      audit: null,
    };
  }
}
