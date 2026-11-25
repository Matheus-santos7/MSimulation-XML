import { apiUrl } from "@/lib/api-base";
import { forwardedClientIpHeaders } from "@/lib/http/client-ip";
import { readApiErrorPayload, type ApiErrorPayload } from "@/lib/http/api-error";

export class AuthApiError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "AuthApiError";
    this.fieldErrors = fieldErrors;
  }
}

export function authApiUrl(path: string): string {
  return apiUrl(path);
}

const AUTH_ERROR_FALLBACK = "Falha na autenticação. Tente novamente em instantes.";

function throwOnAuthError(payload: ApiErrorPayload): never {
  if (payload.details) {
    throw new AuthApiError(payload.error, payload.details);
  }
  throw new Error(payload.error);
}

export async function postAuthJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(authApiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await forwardedClientIpHeaders()) },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("API indisponível. Verifique se o backend está rodando.");
  }
  if (!res.ok) {
    throwOnAuthError(await readApiErrorPayload(res, AUTH_ERROR_FALLBACK));
  }
  return res.json() as Promise<T>;
}

export async function authBearerFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(authApiUrl(path), {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(await forwardedClientIpHeaders()),
        ...init?.headers,
      },
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    });
  } catch {
    throw new Error("API indisponível. Verifique se o backend está rodando.");
  }
  if (!res.ok) {
    throwOnAuthError(await readApiErrorPayload(res, AUTH_ERROR_FALLBACK));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
