export type FiscalValidatorConfig = {
  enabled: boolean;
  apiUrl: string;
};

/**
 * Reads MCP fiscal validator settings from environment.
 */
export function loadFiscalValidatorConfig(): FiscalValidatorConfig {
  const enabledRaw = process.env.FISCAL_VALIDATOR_ENABLED?.trim().toLowerCase();
  const enabled = enabledRaw !== "false" && enabledRaw !== "0";
  const apiUrl = (process.env.FISCAL_VALIDATOR_URL ?? "http://localhost:8080").replace(/\/$/, "");
  return { enabled, apiUrl };
}
