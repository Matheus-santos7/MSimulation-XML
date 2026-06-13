const TECHNICAL_ERROR_PATTERNS = [
  /internal server error/i,
  /prisma/i,
  /invocation in/i,
  /ECONNREFUSED/i,
  /P1001\b/,
  /unexpected token/i,
  /syntaxerror/i,
  /stack trace/i,
  /server action/i,
  /failed to fetch/i,
  /was not found on the server/i,
];

const DEFAULT_FALLBACK =
  "Não foi possível completar a operação. Tente novamente em instantes.";

type UserFacingErrorOptions = {
  status?: number;
  fallback?: string;
};

/** Converte erros técnicos da API em mensagens seguras para exibir na interface. */
export function toUserFacingError(
  raw: string | undefined,
  options?: UserFacingErrorOptions,
): string {
  const fallback = options?.fallback ?? DEFAULT_FALLBACK;
  const message = raw?.trim() ?? "";

  if (!message) {
    return fallbackForStatus(options?.status, fallback);
  }

  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    if (/banco de dados|postgresql|ECONNREFUSED|P1001/i.test(message)) {
      return "Banco de dados indisponível. Verifique se o PostgreSQL está em execução.";
    }
    return fallbackForStatus(options?.status, fallback);
  }

  return message;
}

function fallbackForStatus(status: number | undefined, fallback: string): string {
  if (status === 503) {
    return "Serviço temporariamente indisponível. Tente novamente em instantes.";
  }
  if (status === 401) {
    return "Credenciais inválidas. Verifique e tente novamente.";
  }
  return fallback;
}
