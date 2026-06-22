/** Single issue from MCP `validate_nfe_full`. */
export type NfeMcpIssue = {
  severidade: string;
  código: string;
  descrição: string;
};

/** Raw MCP `validate_nfe_full` response — pass-through from proxy, no invented text. */
export type NfeMcpAudit = {
  chave_acesso: string;
  valida_estruturalmente: boolean;
  chave_consistente: boolean;
  emissor_ativo: boolean;
  cnpj_emissor?: string;
  valor_total?: number;
  data_emissao?: string;
  issues: NfeMcpIssue[];
  resumo: string;
};

/** @deprecated Use NfeMcpIssue — kept for API/UI normalization of legacy audit payloads. */
export type NfeValidationAchado = {
  severidade: string;
  codigo: string;
  mensagem: string;
};

/** Whether the raw MCP report indicates an approved NF-e. */
export function isNfeMcpAuditApproved(audit: NfeMcpAudit): boolean {
  return (
    audit.valida_estruturalmente &&
    audit.chave_consistente &&
    audit.emissor_ativo &&
    audit.issues.length === 0
  );
}

/** Maps MCP issues to operational error strings for `erros_validacao`. */
export function nfeMcpIssuesToErrors(issues: NfeMcpIssue[]): string[] {
  return issues.map((issue) => {
    const label = issue.severidade.trim().toUpperCase();
    return label.length > 0 ? `[${label}] ${issue.descrição}` : issue.descrição;
  });
}
