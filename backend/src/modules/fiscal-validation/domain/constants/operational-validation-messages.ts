/** Shown when FISCAL_VALIDATOR_ENABLED=false — not an MCP audit message. */
export const VALIDATION_DISABLED_MESSAGE = "Validação desabilitada";

/** Shown when the MCP proxy is unreachable — not an MCP audit message. */
export function validatorUnavailableMessage(detail: string): string {
  return `Validador indisponível: ${detail}`;
}

/** Thrown by HTTP adapter on transport failure (captured upstream as unavailable). */
export const VALIDATOR_HTTP_ERROR_MESSAGE =
  "Falha na comunicação com o microsserviço de validação.";
