/** Result of MCP NF-e XML validation. */
export type NfeValidationResult = {
  isValid: boolean;
  message: string;
  errors: string[];
};

/** Outbound port — validate NF-e XML via external MCP service. */
export interface FiscalValidatorPort {
  validateNfe(xmlContent: string): Promise<NfeValidationResult>;
}
