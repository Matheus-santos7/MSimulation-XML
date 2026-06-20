import type {
  FiscalValidatorPort,
  NfeValidationResult,
} from "../../domain/ports/fiscal-validator.port.js";

type McpValidateNfeResponse = {
  valida?: boolean;
  erros?: string[];
};

const REJECTED_MESSAGE = "Foram encontrados erros estruturais/fiscais no XML.";

/**
 * HTTP adapter for mcp-fiscal-brasil `POST /api/v1/validate-nfe`.
 */
export class HttpFiscalValidatorAdapter implements FiscalValidatorPort {
  constructor(
    private readonly apiUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async validateNfe(xmlContent: string): Promise<NfeValidationResult> {
    const response = await this.fetchImpl(`${this.apiUrl}/api/v1/validate-nfe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xml: xmlContent }),
    });

    if (!response.ok) {
      throw new Error("Falha na comunicação com o microsserviço de validação.");
    }

    const data = (await response.json()) as McpValidateNfeResponse;
    const isValid = Boolean(data.valida);

    return {
      isValid,
      message: isValid ? "XML aprovado" : REJECTED_MESSAGE,
      errors: Array.isArray(data.erros) ? data.erros.map(String) : [],
    };
  }
}
