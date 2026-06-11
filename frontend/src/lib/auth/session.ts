import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE_MAX_AGE,
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
  TWO_FACTOR_PENDING_COOKIE,
  TWO_FACTOR_PENDING_MAX_AGE,
  authCookieOptions,
} from "@/lib/auth/cookie";
import { fetchAuthMe, refreshSessionApi } from "@/lib/auth/api/session";
import type { AuthMeDto, AuthSessionDto } from "@/lib/auth/types";

export type AuthSessionPayload = {
  accessToken: string;
  refreshToken: string;
  tenantId: string | null;
  needsOnboarding?: boolean;
  emailVerified?: boolean;
};

/** Apenas em Server Actions / Route Handlers — não chame em Server Components. */
export async function clearAuthSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
  store.delete(TWO_FACTOR_PENDING_COOKIE);
}

export async function setTwoFactorPending(twoFactorToken: string): Promise<void> {
  const store = await cookies();
  store.set(TWO_FACTOR_PENDING_COOKIE, twoFactorToken, authCookieOptions(TWO_FACTOR_PENDING_MAX_AGE));
}

export async function getTwoFactorPending(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(TWO_FACTOR_PENDING_COOKIE)?.value;
}

export async function clearTwoFactorPending(): Promise<void> {
  const store = await cookies();
  store.delete(TWO_FACTOR_PENDING_COOKIE);
}

export async function setAuthSession(session: AuthSessionDto): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, session.accessToken, authCookieOptions(ACCESS_COOKIE_MAX_AGE));
  store.set(REFRESH_TOKEN_COOKIE, session.refreshToken, authCookieOptions(REFRESH_COOKIE_MAX_AGE));
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_TOKEN_COOKIE)?.value;
}

/**
 * Resolve um access token válido sem alterar cookies (seguro em Server Components).
 * Tenta o cookie atual; se expirado, usa refresh só para esta requisição.
 */
export const resolveAccessToken = cache(async (): Promise<string | undefined> => {
  const accessToken = await getAccessToken();
  if (accessToken) {
    const me = await fetchAuthMe(accessToken);
    if (me) return accessToken;
  }

  const refreshToken = await getRefreshToken();
  if (!refreshToken) return undefined;

  try {
    const session = await refreshSessionApi(refreshToken);
    return session.accessToken;
  } catch {
    return undefined;
  }
});

/** Renova sessão e persiste cookies — use só em Server Actions. */
export async function refreshAndPersistSession(): Promise<AuthSessionDto | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  try {
    const session = await refreshSessionApi(refreshToken);
    await setAuthSession(session);
    return session;
  } catch {
    await clearAuthSession();
    return null;
  }
}

export const getAuthMe = cache(async (): Promise<AuthMeDto | null> => {
  const token = await resolveAccessToken();
  if (!token) return null;
  return fetchAuthMe(token);
});

export function redirectAfterAuth(session: AuthSessionPayload): never {
  if (session.emailVerified === false) {
    redirect("/login/verificar-email");
  }
  const needsOnboarding =
    session.needsOnboarding === true || session.tenantId === null || session.tenantId === undefined;
  redirect(needsOnboarding ? "/onboarding/empresa" : "/");
}
