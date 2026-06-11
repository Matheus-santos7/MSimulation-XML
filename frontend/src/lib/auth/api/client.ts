import { apiUrl } from "@/lib/api-base";
import { toUserFacingError } from "@/lib/user-facing-error";

type ApiErrorPayload = {
  error: string;
  details?: Record<string, string[]>;
};

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

async function readApiErrorPayload(res: Response): Promise<ApiErrorPayload> {
  const text = await res.text().catch(() => "");
  if (!text) {
    return {
      error: toUserFacingError(res.statusText, {
        status: res.status,
        fallback: "Falha na autenticação. Tente novamente em instantes.",
      }),
    };
  }
  try {
    const parsed = JSON.parse(text) as {
      error?: string;
      message?: string;
      details?: Record<string, string[]>;
    };
    return {
      error: toUserFacingError(parsed.error ?? parsed.message ?? text, {
        status: res.status,
        fallback: "Falha na autenticação. Tente novamente em instantes.",
      }),
      details: parsed.details,
    };
  } catch {
    return {
      error: toUserFacingError(text, {
        status: res.status,
        fallback: "Falha na autenticação. Tente novamente em instantes.",
      }),
    };
  }
}

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("API indisponível. Verifique se o backend está rodando.");
  }
  if (!res.ok) {
    throwOnAuthError(await readApiErrorPayload(res));
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
        ...init?.headers,
      },
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    });
  } catch {
    throw new Error("API indisponível. Verifique se o backend está rodando.");
  }
  if (!res.ok) {
    throwOnAuthError(await readApiErrorPayload(res));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
