import type { FiscalValidatorPort } from "../modules/fiscal-documents/domain/ports/fiscal-validator.port.js";
import { HttpFiscalValidatorAdapter } from "../modules/fiscal-documents/infrastructure/external/http-fiscal-validator.adapter.js";
import { loadFiscalValidatorConfig } from "./fiscal-validator-config.js";

let cached: FiscalValidatorPort | null = null;

/** Singleton HTTP adapter for MCP fiscal validation. */
export function getFiscalValidator(): FiscalValidatorPort {
  if (!cached) {
    const { apiUrl } = loadFiscalValidatorConfig();
    cached = new HttpFiscalValidatorAdapter(apiUrl);
  }
  return cached;
}

/** Resets cached adapter (tests only). */
export function resetFiscalValidatorForTests(): void {
  cached = null;
}
