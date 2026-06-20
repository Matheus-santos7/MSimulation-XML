/** Single finding from MCP fiscal audit. */
export type NfeValidationAchado = {
  severidade: string;
  codigo: string;
  mensagem: string;
};

/** Full MCP validate-nfe response persisted on NFe. */
export type NfeMcpAudit = {
  valida: boolean;
  resumo: string;
  erros: string[];
  achados: NfeValidationAchado[];
};

/** Result of MCP NF-e XML validation. */
export type NfeValidationResult = {
  isValid: boolean;
  message: string;
  errors: string[];
  audit: NfeMcpAudit;
};

/** Outbound port — validate NF-e XML via external MCP service. */
export interface FiscalValidatorPort {
  validateNfe(xmlContent: string): Promise<NfeValidationResult>;
}
