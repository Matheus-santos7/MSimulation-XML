import {
  VALIDATION_DISABLED_MESSAGE,
  validatorUnavailableMessage,
} from "./operational-validation-messages.js";
import { isNfeMcpAuditApproved, nfeMcpIssuesToErrors, type NfeMcpAudit } from "./nfe-mcp-audit.js";
import type { NfeValidationOutcome } from "../nfe-validation.types.js";
import type { NfeXmlValidator } from "../../providers/fiscal-validator/fiscal-validator.types.js";

export type FiscalValidatorRuntimeConfig = {
  enabled: boolean;
};

function outcomeFromAudit(audit: NfeMcpAudit): NfeValidationOutcome {
  const errors = nfeMcpIssuesToErrors(audit.issues);

  return {
    status: isNfeMcpAuditApproved(audit) ? "APPROVED" : "REJECTED",
    message: audit.resumo.length > 0 ? audit.resumo : null,
    errors: errors.length > 0 ? errors : null,
    audit,
  };
}

/**
 * Orchestrates MCP validation and maps to domain outcome.
 * Never throws — transport errors become PENDING with operational message.
 */
export async function resolveNfeValidation(
  validator: NfeXmlValidator,
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
