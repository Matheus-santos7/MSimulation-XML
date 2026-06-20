import { resolveAccessToken } from "@/lib/auth/session";
import { apiBase } from "@/lib/api-base";
import { toUserFacingError } from "../user-facing-error";

export function buildApiUrl(path: string, query?: Record<string, string | undefined>): string {
  const u = new URL(path.startsWith("/") ? path : `/${path}`, `${apiBase()}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) u.searchParams.set(k, v);
    }
  }
  return u.toString();
}

export async function authHeaders(): Promise<HeadersInit> {
  const token = await resolveAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function readApiError(res: Response): Promise<string> {
  return (await readApiErrorPayload(res)).error;
}

type ApiErrorPayload = {
  error: string;
  details?: Record<string, string[]>;
};

export async function readApiErrorPayload(res: Response): Promise<ApiErrorPayload> {
  const text = await res.text().catch(() => "");
  if (!text) {
    return { error: toUserFacingError(res.statusText, { status: res.status }) };
  }
  try {
    const parsed = JSON.parse(text) as {
      error?: string;
      message?: string;
      details?: Record<string, string[]>;
    };
    const error =
      (typeof parsed.error === "string" && parsed.error) ||
      (typeof parsed.message === "string" && parsed.message) ||
      text;
    return {
      error: toUserFacingError(error, { status: res.status }),
      details: parsed.details,
    };
  } catch {
    return { error: toUserFacingError(text, { status: res.status }) };
  }
}

export class ApiValidationError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export async function getJson<T>(href: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  } catch (err) {
    const base = apiBase();
    const msg =
      err instanceof Error && "cause" in err && err.cause instanceof Error && err.cause.message.includes("ECONNREFUSED")
        ? `API indisponível em ${base}. Rode \`pnpm dev\` na raiz (sobe API + Next) ou \`pnpm dev:backend\` em outro terminal.`
        : err instanceof Error
          ? err.message
          : "Falha ao conectar na API";
    throw new Error(msg);
  }
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json() as Promise<T>;
}

export async function getJsonOrNull<T>(href: string): Promise<T | null> {
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json() as Promise<T>;
}

export async function mutateJson<T>(
  href: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T | void> {
  let res: Response;
  try {
    const baseHeaders = await authHeaders();
    res = await fetch(href, {
      method,
      headers: {
        ...baseHeaders,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    const base = apiBase();
    throw new Error(
      err instanceof Error && String(err).includes("ECONNREFUSED")
        ? `API indisponível em ${base}. Rode \`pnpm dev\` na raiz.`
        : err instanceof Error
          ? err.message
          : "Falha ao conectar na API",
    );
  }
  if (res.status === 204) return;
  if (!res.ok) {
    const payload = await readApiErrorPayload(res);
    if (payload.details) {
      throw new ApiValidationError(payload.error, payload.details);
    }
    throw new Error(payload.error);
  }
  return res.json() as Promise<T>;
}

export async function postFormData<T>(href: string, body: FormData): Promise<T> {
  const res = await fetch(href, {
    method: "POST",
    headers: await authHeaders(),
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const payload = await readApiErrorPayload(res);
    throw new Error(payload.error);
  }

  return res.json() as Promise<T>;
}

export async function fetchTextDocument(
  href: string,
  fallbackFilename: string,
): Promise<{ xml: string; filename: string }> {
  const res = await fetch(href, { cache: "no-store", headers: await authHeaders() });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const xml = await res.text();
  const disp = res.headers.get("Content-Disposition");
  const match = disp?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackFilename;
  return { xml, filename };
}
