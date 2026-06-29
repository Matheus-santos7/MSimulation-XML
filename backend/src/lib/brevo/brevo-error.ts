import { BrevoError } from "@getbrevo/brevo";

const SENSITIVE_PATTERNS = [/xkeysib-/i, /api[_-]?key/i];

/**
 * Converte erros da API Brevo em mensagens seguras para logs e respostas da aplicação.
 */
export function mapBrevoErrorToMessage(error: unknown): string {
  if (error instanceof BrevoError) {
    const statusCode = error.statusCode;
    if (statusCode === 401 || statusCode === 403) {
      return "Falha de autenticação com o provedor de e-mail";
    }
    if (statusCode === 400) {
      return "Destinatário ou conteúdo do e-mail inválido";
    }
    if (statusCode === 404) {
      return "Recurso de e-mail não encontrado no provedor";
    }
    if (statusCode && statusCode >= 500) {
      return "Provedor de e-mail indisponível. Tente novamente em instantes.";
    }

    const bodyMessage = extractBodyMessage(error.body);
    if (bodyMessage) return sanitizeMessage(bodyMessage);
  }

  if (error instanceof Error) {
    if (error.name === "BrevoTimeoutError" || error.message.toLowerCase().includes("timeout")) {
      return "Tempo esgotado ao enviar e-mail. Tente novamente em instantes.";
    }
    if (error.message.toLowerCase().includes("fetch") || error.message.toLowerCase().includes("network")) {
      return "Falha de rede ao enviar e-mail. Tente novamente em instantes.";
    }
    return sanitizeMessage(error.message);
  }

  return "Falha ao enviar e-mail. Tente novamente em instantes.";
}

function extractBodyMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const record = body as { message?: unknown; error?: unknown; code?: unknown };
  if (typeof record.message === "string" && record.message.trim()) return record.message.trim();
  if (typeof record.error === "string" && record.error.trim()) return record.error.trim();
  return undefined;
}

function sanitizeMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Falha ao enviar e-mail. Tente novamente em instantes.";
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "Falha ao enviar e-mail. Tente novamente em instantes.";
  }
  return trimmed;
}
