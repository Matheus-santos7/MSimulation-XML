import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  TWO_FACTOR_PENDING_COOKIE,
} from "@/lib/auth/cookie";
import { clearAuthCookiesOn, refreshTokensViaApi, setSessionCookiesOn } from "@/lib/auth/edge-cookies";

const LOGIN_PREFIX = "/login";
const LOGIN_PUBLIC_SUFFIXES = ["/esqueci-senha", "/redefinir-senha"];

function isLoginPublicPath(pathname: string): boolean {
  return LOGIN_PUBLIC_SUFFIXES.some((s) => pathname === `${LOGIN_PREFIX}${s}`);
}

function redirectLogin(request: NextRequest, reason?: "expired"): NextResponse {
  const login = new URL(LOGIN_PREFIX, request.url);
  if (reason) login.searchParams.set("session", reason);
  const from = request.nextUrl.pathname;
  if (from && from !== LOGIN_PREFIX && !from.startsWith(`${LOGIN_PREFIX}/`)) {
    login.searchParams.set("from", from);
  }
  const response = NextResponse.redirect(login);
  if (reason === "expired") clearAuthCookiesOn(response);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const access = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const pending2fa = request.cookies.get(TWO_FACTOR_PENDING_COOKIE)?.value;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // --- Rotas de login / recuperação ---
  if (pathname.startsWith(LOGIN_PREFIX)) {
    if (request.nextUrl.searchParams.get("session") === "expired") {
      const response = NextResponse.next();
      clearAuthCookiesOn(response);
      return response;
    }

    if (pathname === "/login/verificar-2fa") {
      if (access && refresh) {
        return NextResponse.redirect(new URL("/", request.url));
      }
      if (!pending2fa) {
        return NextResponse.redirect(new URL(LOGIN_PREFIX, request.url));
      }
      return NextResponse.next();
    }

    if (isLoginPublicPath(pathname)) {
      return NextResponse.next();
    }

    if (pending2fa && pathname === LOGIN_PREFIX) {
      return NextResponse.redirect(new URL("/login/verificar-2fa", request.url));
    }

    if (access && refresh) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  // --- Rotas protegidas ---
  if (pending2fa && !access) {
    return NextResponse.redirect(new URL("/login/verificar-2fa", request.url));
  }

  if (!access && refresh) {
    const renewed = await refreshTokensViaApi(refresh);
    if (renewed) {
      const response = NextResponse.next();
      setSessionCookiesOn(response, renewed.accessToken, renewed.refreshToken);
      return response;
    }
    return redirectLogin(request, "expired");
  }

  if (!access && !refresh) {
    return redirectLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
