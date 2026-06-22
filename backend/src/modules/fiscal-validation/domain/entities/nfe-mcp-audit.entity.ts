/** Single finding from MCP fiscal audit. */
export type NfeValidationAchado = {
  severidade: string;
  codigo: string;
  mensagem: string;
};

/** Full MCP validate-nfe response — pass-through from proxy, no invented text. */
export type NfeMcpAudit = {
  valida: boolean;
  resumo: string;
  erros: string[];
  achados: NfeValidationAchado[];
};
