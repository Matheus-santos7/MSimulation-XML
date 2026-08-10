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
  authCookieBaseOptions,
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

function clearCookie(store: Awaited<ReturnType<typeof cookies>>, name: string): void {
  // Em produção (Secure) o delete precisa espelhar path/sameSite/secure do Set-Cookie.
  store.set(name, "", { ...authCookieBaseOptions(), maxAge: 0 });
}

/** Apenas em Server Actions / Route Handlers — não chame em Server Components. */
export async function clearAuthSession(): Promise<void> {
  const store = await cookies();
  clearCookie(store, ACCESS_TOKEN_COOKIE);
  clearCookie(store, REFRESH_TOKEN_COOKIE);
  clearCookie(store, TWO_FACTOR_PENDING_COOKIE);
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
  clearCookie(store, TWO_FACTOR_PENDING_COOKIE);
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
 * Resolve token + `/auth/me` uma única vez por request RSC.
 * Antes: `resolveAccessToken` e `getAuthMe` cada um chamavam `/auth/me` (~2× latência Neon).
 */
const resolveAuthSession = cache(async (): Promise<{ token: string; me: AuthMeDto } | null> => {
  const accessToken = await getAccessToken();
  if (accessToken) {
    const me = await fetchAuthMe(accessToken);
    if (me) return { token: accessToken, me };
  }

  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const session = await refreshSessionApi(refreshToken);
    const me = await fetchAuthMe(session.accessToken);
    if (!me) return null;
    return { token: session.accessToken, me };
  } catch {
    return null;
  }
});

/**
 * Resolve um access token válido sem alterar cookies (seguro em Server Components).
 * Tenta o cookie atual; se expirado, usa refresh só para esta requisição.
 */
export const resolveAccessToken = cache(async (): Promise<string | undefined> => {
  const session = await resolveAuthSession();
  return session?.token;
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
  const session = await resolveAuthSession();
  return session?.me ?? null;
});

/** Destino pós-login/2FA sem lançar redirect (útil com useActionState no cliente). */
export function pathAfterAuth(session: AuthSessionPayload): string {
  if (session.emailVerified === false) {
    return "/login/verificar-email";
  }
  const needsOnboarding =
    session.needsOnboarding === true || session.tenantId === null || session.tenantId === undefined;
  return needsOnboarding ? "/onboarding/empresa" : "/";
}

export function redirectAfterAuth(session: AuthSessionPayload): never {
  redirect(pathAfterAuth(session));
}
