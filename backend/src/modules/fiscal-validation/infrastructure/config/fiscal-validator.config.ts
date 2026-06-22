export type FiscalValidatorConfig = {
  enabled: boolean;
  apiUrl: string;
};

/**
 * Normalizes validator base URL from env (supports full URL or Render host:port).
 */
export function resolveFiscalValidatorApiUrl(): string {
  const raw = process.env.FISCAL_VALIDATOR_URL?.trim();
  if (raw) {
    if (raw.includes("://")) {
      return raw.replace(/\/$/, "");
    }
    return `http://${raw.replace(/\/$/, "")}`;
  }

  const hostPort = process.env.FISCAL_VALIDATOR_HOSTPORT?.trim();
  if (hostPort) {
    return `http://${hostPort.replace(/\/$/, "")}`;
  }

  return "http://localhost:8080";
}

/** Reads MCP fiscal validator settings from environment. */
export function loadFiscalValidatorConfig(): FiscalValidatorConfig {
  const enabledRaw = process.env.FISCAL_VALIDATOR_ENABLED?.trim().toLowerCase();
  const enabled = enabledRaw !== "false" && enabledRaw !== "0";
  return { enabled, apiUrl: resolveFiscalValidatorApiUrl() };
}
