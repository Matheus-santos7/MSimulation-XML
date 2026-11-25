import { toUserFacingError } from "@/lib/user-facing-error";

export type ApiErrorPayload = {
  error: string;
  details?: Record<string, string[]>;
};

/**
 * Corpo de erro da API → mensagem para o usuário. Aceita `{ error }` (contrato do backend),
 * `{ message }` ou texto puro, e repassa `details` (erros de campo do Zod). Corpo vazio usa o
 * fallback em português, nunca o `statusText` HTTP. Seguro em Server e Client Components.
 */
export async function readApiErrorPayload(
  res: Response,
  fallback?: string,
): Promise<ApiErrorPayload> {
  const options = { status: res.status, fallback };
  const text = await res.text().catch(() => "");
  if (!text) {
    return { error: toUserFacingError(undefined, options) };
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: unknown;
      message?: unknown;
      details?: Record<string, string[]>;
    };
    const message =
      (typeof parsed.error === "string" && parsed.error) ||
      (typeof parsed.message === "string" && parsed.message) ||
      text;

    return { error: toUserFacingError(message, options), details: parsed.details };
  } catch {
    return { error: toUserFacingError(text, options) };
  }
}

export async function readApiErrorMessage(res: Response, fallback?: string): Promise<string> {
  return (await readApiErrorPayload(res, fallback)).error;
}
