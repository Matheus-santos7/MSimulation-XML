import type { NfeMcpAudit } from "../entities/nfe-mcp-audit.entity.js";

/** Outbound port — validate NF-e XML via MCP fiscal proxy. */
export interface McpFiscalValidatorPort {
  validateNfe(xmlContent: string): Promise<NfeMcpAudit>;
}
