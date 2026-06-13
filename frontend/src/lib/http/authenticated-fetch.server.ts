"use server";

import { apiUrl } from "@/lib/api-base";
import { resolveAccessToken } from "@/lib/auth/session";
import { toUserFacingError } from "@/lib/user-facing-error";

export type AuthenticatedFetchResult = {
  bodyBase64: string;
  contentType: string | null;
  contentDisposition: string | null;
};

async function readApiError(res: Response): Promise<string> {
  const text = await res.text().catch(() => res.statusText);
  if (!text) {
    return toUserFacingError(undefined, { status: res.status });
  }
  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    const message =
      (typeof parsed.error === "string" && parsed.error) ||
      (typeof parsed.message === "string" && parsed.message) ||
      text;
    return toUserFacingError(message, { status: res.status });
  } catch {
    return toUserFacingError(text, { status: res.status });
  }
}

/** Busca autenticada no backend via `API_URL` (server-only). */
export async function fetchAuthenticatedApi(path: string): Promise<AuthenticatedFetchResult> {
  const token = await resolveAccessToken();
  if (!token) {
    throw new Error("Sessão expirada. Entre novamente.");
  }

  const res = await fetch(apiUrl(path), {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    bodyBase64: buffer.toString("base64"),
    contentType: res.headers.get("Content-Type"),
    contentDisposition: res.headers.get("Content-Disposition"),
  };
}
