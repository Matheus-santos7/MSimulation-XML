import type { NfeMcpAudit } from "../../domain/entities/nfe-mcp-audit.entity.js";
import type { McpFiscalValidatorPort } from "../../domain/ports/mcp-fiscal-validator.port.js";

/** In-memory MCP validator for tests. */
export class FakeMcpFiscalValidatorAdapter implements McpFiscalValidatorPort {
  constructor(private readonly audit: NfeMcpAudit) {}

  async validateNfe(_xmlContent: string): Promise<NfeMcpAudit> {
    return this.audit;
  }
}

/** Builds a minimal MCP audit payload for tests. */
export function buildFakeMcpAudit(
  overrides: Partial<NfeMcpAudit> & Pick<NfeMcpAudit, "valida">,
): NfeMcpAudit {
  return {
    resumo: overrides.resumo ?? (overrides.valida ? "NF-e aprovada" : "NF-e rejeitada"),
    erros: overrides.erros ?? [],
    achados: overrides.achados ?? [],
    valida: overrides.valida,
  };
}
