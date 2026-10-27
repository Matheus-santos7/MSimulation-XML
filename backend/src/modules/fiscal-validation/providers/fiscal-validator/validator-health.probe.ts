import { VALIDATION_DISABLED_MESSAGE } from "../../nfe-validation/rules/operational-validation-messages.js";
import type { FiscalValidatorConfig } from "./fiscal-validator.config.js";
import type { ValidatorHealth } from "../../validator-status/validator-status.types.js";

const HEALTH_TIMEOUT_MS = 5_000;

/** Probes MCP fiscal validator availability for diagnostics and admin UI. */
export async function probeValidatorHealth(
  config: FiscalValidatorConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ValidatorHealth> {
  if (!config.enabled) {
    return {
      enabled: false,
      apiUrl: config.apiUrl,
      reachable: false,
      message: `${VALIDATION_DISABLED_MESSAGE} (FISCAL_VALIDATOR_ENABLED=false)`,
    };
  }

  try {
    const response = await fetchImpl(`${config.apiUrl}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        enabled: true,
        apiUrl: config.apiUrl,
        reachable: false,
        message: `Validador respondeu HTTP ${response.status}`,
      };
    }
    return {
      enabled: true,
      apiUrl: config.apiUrl,
      reachable: true,
      message: "Validador MCP disponível",
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erro desconhecido";
    return {
      enabled: true,
      apiUrl: config.apiUrl,
      reachable: false,
      message: `Validador indisponível: ${detail}`,
    };
  }
}
