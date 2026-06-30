import { authApiUrl, authBearerFetch, postAuthJson } from "./client";
import type { AuthMeDto, AuthSessionDto } from "../types";

export async function refreshSessionApi(refreshToken: string): Promise<AuthSessionDto> {
  return postAuthJson<AuthSessionDto>("/api/auth/refresh", { refreshToken });
}

export async function logoutApi(refreshToken?: string, accessToken?: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(authApiUrl("/api/auth/logout"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      cache: "no-store",
    });
  } catch {
    return;
  }
  if (!res.ok && res.status !== 204) {
    await res.text().catch(() => "");
  }
}

/**
 * Carrega o perfil autenticado. Retorna `null` quando a sessão é inválida ou a API
 * está indisponível — evita derrubar Server Components com erro genérico em produção.
 */
export async function fetchAuthMe(accessToken: string): Promise<AuthMeDto | null> {
  let res: Response;
  try {
    res = await fetch(authApiUrl("/api/auth/me"), {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }

  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) return null;

  return res.json() as Promise<AuthMeDto>;
}

export async function resendVerificationApi(accessToken: string): Promise<{ message: string }> {
  return authBearerFetch<{ message: string }>(accessToken, "/api/auth/resend-verification", {
    method: "POST",
    json: {},
  });
}
