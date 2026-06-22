import type { NfeMcpAudit, NfeMcpIssue } from "../../domain/entities/nfe-mcp-audit.entity.js";
import type { McpFiscalValidatorPort } from "../../domain/ports/mcp-fiscal-validator.port.js";

/** In-memory MCP validator for tests. */
export class FakeMcpFiscalValidatorAdapter implements McpFiscalValidatorPort {
  constructor(private readonly audit: NfeMcpAudit) {}

  async validateNfe(_xmlContent: string): Promise<NfeMcpAudit> {
    return this.audit;
  }
}

type BuildFakeMcpAuditInput = {
  approved: boolean;
  resumo?: string;
  issues?: NfeMcpIssue[];
  chave_acesso?: string;
  cnpj_emissor?: string;
};

/** Builds a raw MCP `validate_nfe_full` payload for tests. */
export function buildFakeMcpAudit(input: BuildFakeMcpAuditInput): NfeMcpAudit {
  const approved = input.approved;

  return {
    chave_acesso: input.chave_acesso ?? "35260601490698006689550580000000311306171272",
    valida_estruturalmente: approved,
    chave_consistente: approved,
    emissor_ativo: approved,
    cnpj_emissor: input.cnpj_emissor ?? "01490698006689",
    issues: input.issues ?? [],
    resumo:
      input.resumo ??
      (approved
        ? "NFe válida estruturalmente, chave consistente, emissor ativo."
        : "NFe rejeitada na validação estrutural."),
  };
}
