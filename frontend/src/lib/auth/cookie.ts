export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const TWO_FACTOR_PENDING_COOKIE = "two_factor_pending";

/** 30 min — alinhado ao JWT_ACCESS_EXPIRES_IN padrão do backend */
export const ACCESS_COOKIE_MAX_AGE = 30 * 60;

/** 7 dias — alinhado ao refresh do backend */
export const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

/** 5 min — token pendente de 2FA após login */
export const TWO_FACTOR_PENDING_MAX_AGE = 5 * 60;

/** Usado em session.ts (cookies API) e edge-cookies.ts (middleware). */
export function isCookieSecure(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.COOKIE_SECURE === "true"
  );
}

export function authCookieBaseOptions() {
  return {
    httpOnly: true,
    secure: isCookieSecure(),
    sameSite: "strict" as const,
    path: "/",
  };
}

export function authCookieOptions(maxAge: number) {
  return { ...authCookieBaseOptions(), maxAge };
}
