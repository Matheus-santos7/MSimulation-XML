import { appConfig } from "../../../../config/config.service.js";
export type FiscalValidatorConfig = {
  enabled: boolean;
  apiUrl: string;
};

/**
 * Normalizes validator base URL from env (supports full URL or Render host:port).
 */
export function resolveFiscalValidatorApiUrl(): string {
  const raw = appConfig.fiscalValidatorUrl?.trim();
  if (raw) {
    if (raw.includes("://")) {
      return raw.replace(/\/$/, "");
    }
    return `http://${raw.replace(/\/$/, "")}`;
  }

  const hostPort = appConfig.fiscalValidatorHostPort?.trim();
  if (hostPort) {
    return `http://${hostPort.replace(/\/$/, "")}`;
  }

  return "http://localhost:8080";
}

/** Reads MCP fiscal validator settings from environment. */
export function loadFiscalValidatorConfig(): FiscalValidatorConfig {
  const enabledRaw = appConfig.fiscalValidatorEnabled?.trim().toLowerCase();
  const enabled = enabledRaw !== "false" && enabledRaw !== "0";
  return { enabled, apiUrl: resolveFiscalValidatorApiUrl() };
}
