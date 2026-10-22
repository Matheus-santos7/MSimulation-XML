import { Injectable } from "@nestjs/common";
import type { NfeMcpAudit } from "../../nfe-validation/rules/nfe-mcp-audit.js";
import { VALIDATOR_HTTP_ERROR_MESSAGE } from "../../nfe-validation/rules/operational-validation-messages.js";
import type { ValidatorHealth } from "../../validator-status/validator-status.types.js";
import {
  loadFiscalValidatorConfig,
  type FiscalValidatorConfig,
} from "./fiscal-validator.config.js";
import type { NfeXmlValidator } from "./fiscal-validator.types.js";
import { mapMcpValidateNfeResponse } from "./mcp-validate-nfe-response.mapper.js";
import { probeValidatorHealth } from "./validator-health.probe.js";

const VALIDATE_TIMEOUT_MS = 10_000;

/**
 * Cliente HTTP do fiscal-validator-proxy (`POST /api/v1/validate-nfe`, `GET /health`).
 * Devolve o payload `validate_nfe_full` do MCP sem inventar mensagens de aprovação.
 */
@Injectable()
export class FiscalValidatorProvider implements NfeXmlValidator {
  readonly config: FiscalValidatorConfig;

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    config: FiscalValidatorConfig = loadFiscalValidatorConfig(),
  ) {
    this.config = config;
  }

  async validateNfe(xmlContent: string): Promise<NfeMcpAudit> {
    const response = await this.fetchImpl(`${this.config.apiUrl}/api/v1/validate-nfe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xml: xmlContent }),
      signal: AbortSignal.timeout(VALIDATE_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(VALIDATOR_HTTP_ERROR_MESSAGE);
    }

    const data = (await response.json()) as Parameters<typeof mapMcpValidateNfeResponse>[0];

    return mapMcpValidateNfeResponse(data);
  }

  health(): Promise<ValidatorHealth> {
    return probeValidatorHealth(this.config, this.fetchImpl);
  }
}
