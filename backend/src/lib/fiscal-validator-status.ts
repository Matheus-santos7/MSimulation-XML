import { loadFiscalValidatorConfig } from "./fiscal-validator-config.js";

export type FiscalValidatorStatus = {
  enabled: boolean;
  apiUrl: string;
  reachable: boolean;
  message: string;
};

const HEALTH_TIMEOUT_MS = 5_000;

/**
 * Probes MCP fiscal validator availability for diagnostics and admin UI.
 */
export async function getFiscalValidatorStatus(
  fetchImpl: typeof fetch = fetch,
): Promise<FiscalValidatorStatus> {
  const config = loadFiscalValidatorConfig();

  if (!config.enabled) {
    return {
      enabled: false,
      apiUrl: config.apiUrl,
      reachable: false,
      message: "Validação desabilitada (FISCAL_VALIDATOR_ENABLED=false)",
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
