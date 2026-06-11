import type { NextResponse } from "next/server";
import { apiBase } from "@/lib/api-base";
import {
  ACCESS_COOKIE_MAX_AGE,
  ACCESS_TOKEN_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
  TWO_FACTOR_PENDING_COOKIE,
  authCookieBaseOptions,
} from "@/lib/auth/cookie";

export function clearAuthCookiesOn(response: NextResponse): void {
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  response.cookies.delete(TWO_FACTOR_PENDING_COOKIE);
}

export function setSessionCookiesOn(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...authCookieBaseOptions(),
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...authCookieBaseOptions(),
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

export function apiBaseUrl(): string {
  return apiBase();
}

export async function refreshTokensViaApi(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    if (!data.accessToken || !data.refreshToken) return null;
    return data;
  } catch {
    return null;
  }
}
