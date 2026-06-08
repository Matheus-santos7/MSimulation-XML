import type { TenantDto, TenantInput } from "@/lib/fiscal-types";
import { apiUrl } from "@/lib/api-base";
import { toUserFacingError } from "@/lib/user-facing-error";

function url(path: string): string {
  return apiUrl(path);
}

export type AuthSessionDto = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  userId: string;
  tenantId: string | null;
  email: string;
  name?: string;
  tenant: TenantDto | null;
  needsOnboarding: boolean;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  role?: "ADMIN" | "MEMBER";
};

export type TwoFactorPendingDto = {
  requiresTwoFactor: true;
  twoFactorToken: string;
  expiresIn: string;
};

export type LoginResultDto = AuthSessionDto | TwoFactorPendingDto;

export function isTwoFactorPending(result: LoginResultDto): result is TwoFactorPendingDto {
  return "requiresTwoFactor" in result && result.requiresTwoFactor === true;
}

export type AuthMeDto = {
  userId: string;
  tenantId: string | null;
  email: string;
  name?: string;
  tenant: TenantDto | null;
  needsOnboarding: boolean;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  role?: "ADMIN" | "MEMBER";
};

export type TwoFactorSetupDto = {
  secret: string;
  otpauthUrl: string;
  issuer: string;
};

export type TwoFactorStatusDto = {
  enabled: boolean;
};

type ApiErrorPayload = {
  error: string;
  details?: Record<string, string[]>;
};

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
    const parsed = JSON.parse(text) as { error?: string; message?: string; details?: Record<string, string[]> };
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

export class AuthApiError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "AuthApiError";
    this.fieldErrors = fieldErrors;
  }
}

async function postAuthJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("API indisponível. Verifique se o backend está rodando.");
  }
  if (!res.ok) {
    const payload = await readApiErrorPayload(res);
    if (payload.details) {
      throw new AuthApiError(payload.error, payload.details);
    }
    throw new Error(payload.error);
  }
  return res.json() as Promise<T>;
}

async function postAuth(path: string, body: unknown): Promise<AuthSessionDto> {
  return postAuthJson<AuthSessionDto>(path, body);
}

export async function loginApi(email: string, password: string): Promise<LoginResultDto> {
  return postAuthJson<LoginResultDto>("/api/auth/login", { email, password });
}

export async function verify2faApi(twoFactorToken: string, code: string): Promise<AuthSessionDto> {
  return postAuth("/api/auth/login/verify-2fa", { twoFactorToken, code });
}

export async function registerApi(input: {
  email: string;
  password: string;
  name?: string;
  captchaToken?: string;
}): Promise<AuthSessionDto> {
  return postAuth("/api/auth/register", input);
}

export async function verifyEmailApi(token: string): Promise<{ message: string }> {
  return postAuthJson<{ message: string }>("/api/auth/verify-email", { token });
}

export async function resendVerificationApi(accessToken: string): Promise<{ message: string }> {
  const res = await fetch(url("/api/auth/resend-verification"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const payload = await readApiErrorPayload(res);
    throw new AuthApiError(payload.error, payload.details);
  }
  return res.json() as Promise<{ message: string }>;
}

export async function refreshSessionApi(refreshToken: string): Promise<AuthSessionDto> {
  return postAuth("/api/auth/refresh", { refreshToken });
}

export async function logoutApi(refreshToken?: string, accessToken?: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url("/api/auth/logout"), {
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
    await readApiErrorPayload(res);
  }
}

export async function onboardingTenantApi(
  accessToken: string,
  input: TenantInput,
): Promise<AuthSessionDto> {
  let res: Response;
  try {
    res = await fetch(url("/api/auth/onboarding/tenant"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });
  } catch {
    throw new Error("API indisponível. Verifique se o backend está rodando.");
  }
  if (!res.ok) {
    const payload = await readApiErrorPayload(res);
    if (payload.details) {
      throw new AuthApiError(payload.error, payload.details);
    }
    throw new Error(payload.error);
  }
  return res.json() as Promise<AuthSessionDto>;
}

export async function forgotPasswordApi(email: string): Promise<{ message: string }> {
  let res: Response;
  try {
    res = await fetch(url("/api/auth/forgot-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
  } catch {
    throw new Error("API indisponível. Verifique se o backend está rodando.");
  }
  if (!res.ok) {
    const payload = await readApiErrorPayload(res);
    if (payload.details) {
      throw new AuthApiError(payload.error, payload.details);
    }
    throw new Error(payload.error);
  }
  return res.json() as Promise<{ message: string }>;
}

export async function resetPasswordApi(token: string, password: string): Promise<{ message: string }> {
  let res: Response;
  try {
    res = await fetch(url("/api/auth/reset-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
      cache: "no-store",
    });
  } catch {
    throw new Error("API indisponível. Verifique se o backend está rodando.");
  }
  if (!res.ok) {
    const payload = await readApiErrorPayload(res);
    if (payload.details) {
      throw new AuthApiError(payload.error, payload.details);
    }
    throw new Error(payload.error);
  }
  return res.json() as Promise<{ message: string }>;
}

export async function fetchAuthMe(accessToken: string): Promise<AuthMeDto | null> {
  const res = await fetch(url("/api/auth/me"), {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error((await readApiErrorPayload(res)).error);
  return res.json() as Promise<AuthMeDto>;
}

async function authBearerFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url(path), {
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
    const payload = await readApiErrorPayload(res);
    if (payload.details) {
      throw new AuthApiError(payload.error, payload.details);
    }
    throw new Error(payload.error);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetch2faStatus(accessToken: string): Promise<TwoFactorStatusDto> {
  return authBearerFetch(accessToken, "/api/auth/2fa/status");
}

export async function setup2faApi(accessToken: string): Promise<TwoFactorSetupDto> {
  return authBearerFetch(accessToken, "/api/auth/2fa/setup", { method: "POST", json: {} });
}

export async function enable2faApi(accessToken: string, code: string): Promise<{ enabled: boolean }> {
  return authBearerFetch(accessToken, "/api/auth/2fa/enable", { method: "POST", json: { code } });
}

export async function disable2faApi(
  accessToken: string,
  password: string,
  code: string,
): Promise<{ enabled: boolean }> {
  return authBearerFetch(accessToken, "/api/auth/2fa/disable", {
    method: "POST",
    json: { password, code },
  });
}
