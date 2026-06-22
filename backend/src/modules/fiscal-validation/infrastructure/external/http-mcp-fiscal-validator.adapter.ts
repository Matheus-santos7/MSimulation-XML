import { VALIDATOR_HTTP_ERROR_MESSAGE } from "../../domain/constants/operational-validation-messages.js";
import type { McpFiscalValidatorPort } from "../../domain/ports/mcp-fiscal-validator.port.js";
import { mapMcpValidateNfeResponse } from "./mcp-validate-nfe-response.mapper.js";

/**
 * HTTP adapter for fiscal-validator-proxy (`POST /api/v1/validate-nfe`).
 * Returns raw MCP `validate_nfe_full` payload without inventing approval/rejection messages.
 */
export class HttpMcpFiscalValidatorAdapter implements McpFiscalValidatorPort {
  constructor(
    private readonly apiUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async validateNfe(xmlContent: string) {
    const response = await this.fetchImpl(`${this.apiUrl}/api/v1/validate-nfe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xml: xmlContent }),
    });

    if (!response.ok) {
      throw new Error(VALIDATOR_HTTP_ERROR_MESSAGE);
    }

    const data = (await response.json()) as Parameters<typeof mapMcpValidateNfeResponse>[0];
    return mapMcpValidateNfeResponse(data);
  }
}
