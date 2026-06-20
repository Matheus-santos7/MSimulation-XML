import type {
  FiscalValidatorPort,
  NfeMcpAudit,
  NfeValidationResult,
} from "../../domain/ports/fiscal-validator.port.js";

/** In-memory validator for tests. */
export class FakeFiscalValidatorAdapter implements FiscalValidatorPort {
  constructor(private readonly result: NfeValidationResult) {}

  async validateNfe(_xmlContent: string): Promise<NfeValidationResult> {
    return this.result;
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
