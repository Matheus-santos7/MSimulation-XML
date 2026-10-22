import type { NfeMcpAudit } from "../../nfe-validation/rules/nfe-mcp-audit.js";

/** O que a validação precisa do validador MCP (o provider HTTP ou um fake nos testes). */
export type NfeXmlValidator = {
  validateNfe(xmlContent: string): Promise<NfeMcpAudit>;
};
