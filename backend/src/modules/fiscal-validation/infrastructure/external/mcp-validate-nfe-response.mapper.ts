import type { NfeMcpAudit, NfeMcpIssue } from "../../domain/entities/nfe-mcp-audit.entity.js";

type McpValidateNfeFullResponse = {
  chave_acesso?: string;
  valida_estruturalmente?: boolean;
  chave_consistente?: boolean;
  emissor_ativo?: boolean;
  cnpj_emissor?: string | null;
  valor_total?: number | null;
  data_emissao?: string | null;
  issues?: Array<{
    severidade?: string;
    código?: string;
    codigo?: string;
    descrição?: string;
    descricao?: string;
  }>;
  resumo?: string;
};

function mapIssue(item: NonNullable<McpValidateNfeFullResponse["issues"]>[number]): NfeMcpIssue {
  return {
    severidade: String(item.severidade ?? ""),
    código: String(item.código ?? item.codigo ?? ""),
    descrição: String(item.descrição ?? item.descricao ?? ""),
  };
}

/**
 * Maps raw MCP `validate_nfe_full` JSON to domain audit — pass-through text, type coercion only.
 */
export function mapMcpValidateNfeResponse(data: McpValidateNfeFullResponse): NfeMcpAudit {
  const issues = Array.isArray(data.issues) ? data.issues.map(mapIssue) : [];
  const resumo = typeof data.resumo === "string" ? data.resumo.trim() : "";

  const audit: NfeMcpAudit = {
    chave_acesso: typeof data.chave_acesso === "string" ? data.chave_acesso : "",
    valida_estruturalmente: Boolean(data.valida_estruturalmente),
    chave_consistente: Boolean(data.chave_consistente),
    emissor_ativo: Boolean(data.emissor_ativo),
    issues,
    resumo,
  };

  if (typeof data.cnpj_emissor === "string" && data.cnpj_emissor.length > 0) {
    audit.cnpj_emissor = data.cnpj_emissor;
  }
  if (typeof data.valor_total === "number" && Number.isFinite(data.valor_total)) {
    audit.valor_total = data.valor_total;
  }
  if (typeof data.data_emissao === "string" && data.data_emissao.length > 0) {
    audit.data_emissao = data.data_emissao;
  }

  return audit;
}
