import type { NfeMcpAudit, NfeValidationAchado } from "../../domain/entities/nfe-mcp-audit.entity.js";

type McpValidateNfeResponse = {
  valida?: boolean;
  erros?: string[];
  resumo?: string;
  achados?: NfeValidationAchado[];
};

/**
 * Maps MCP proxy JSON to domain audit — pass-through text, type coercion only.
 */
export function mapMcpValidateNfeResponse(data: McpValidateNfeResponse): NfeMcpAudit {
  const erros = Array.isArray(data.erros) ? data.erros.map(String) : [];
  const resumo = typeof data.resumo === "string" ? data.resumo.trim() : "";
  const achados = Array.isArray(data.achados)
    ? data.achados.map((item) => ({
        severidade: String(item.severidade ?? ""),
        codigo: String(item.codigo ?? ""),
        mensagem: String(item.mensagem ?? ""),
      }))
    : [];

  return {
    valida: Boolean(data.valida),
    resumo,
    erros,
    achados,
  };
}
