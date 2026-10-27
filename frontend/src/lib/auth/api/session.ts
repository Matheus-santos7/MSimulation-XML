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
 * `null` só quando o token é rejeitado (401/404). Falhas transitórias (503, rede) lançam:
 * tratá-las como "sem sessão" deslogava o usuário a cada instabilidade do banco.
 */
export async function fetchAuthMe(accessToken: string): Promise<AuthMeDto | null> {
  let res: Response;
  try {
    res = await fetch(authApiUrl("/api/auth/me"), {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new Error("API indisponível. Verifique se o backend está rodando.");
  }

  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Serviço indisponível");
  }

  return res.json() as Promise<AuthMeDto>;
}

export async function resendVerificationApi(accessToken: string): Promise<{ message: string }> {
  return authBearerFetch<{ message: string }>(accessToken, "/api/auth/resend-verification", {
    method: "POST",
    json: {},
  });
}
