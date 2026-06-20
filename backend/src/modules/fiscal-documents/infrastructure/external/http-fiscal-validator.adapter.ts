import type {
  FiscalValidatorPort,
  NfeValidationResult,
} from "../../domain/ports/fiscal-validator.port.js";

type McpValidateNfeResponse = {
  valida?: boolean;
  erros?: string[];
  resumo?: string;
  achados?: Array<{ severidade: string; codigo: string; mensagem: string }>;
};

const REJECTED_MESSAGE = "NF-e rejeitada na auditoria fiscal (estrutura, chave ou regras CAT 31).";

/**
 * HTTP adapter for msedit fiscal validator proxy (`POST /api/v1/validate-nfe`).
 * The upstream mcp-fiscal-brasil REST API only accepts xml_path on disk; our
 * Render image runs a thin proxy that accepts inline XML in the request body.
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
    const errors = Array.isArray(data.erros) ? data.erros.map(String) : [];
    const resumo = typeof data.resumo === "string" ? data.resumo.trim() : "";

    return {
      isValid,
      message: isValid
        ? resumo || "NF-e aprovada na auditoria fiscal"
        : resumo || REJECTED_MESSAGE,
      errors,
    };
  }
}
