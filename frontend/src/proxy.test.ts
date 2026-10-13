import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy.js";

const originalFetch = globalThis.fetch;

function mockRefreshResponse(tokens: { accessToken: string; refreshToken: string } | null) {
  globalThis.fetch = (async () =>
    tokens
      ? Response.json(tokens)
      : Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 })) as typeof fetch;
}

function protectedRequest(cookie: string): NextRequest {
  return new NextRequest("https://app.example.com/nfe", { headers: { cookie } });
}

describe("proxy — renovação de sessão", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("repassa os tokens renovados para a renderização da mesma requisição", async () => {
    mockRefreshResponse({ accessToken: "new-access", refreshToken: "new-refresh" });

    const response = await proxy(protectedRequest("refresh_token=old-refresh"));

    const forwardedCookies = response.headers.get("x-middleware-request-cookie") ?? "";
    assert.match(forwardedCookies, /access_token=new-access/);
    assert.match(forwardedCookies, /refresh_token=new-refresh/);
    assert.doesNotMatch(forwardedCookies, /old-refresh/);
  });

  it("grava os tokens renovados no navegador", async () => {
    mockRefreshResponse({ accessToken: "new-access", refreshToken: "new-refresh" });

    const response = await proxy(protectedRequest("refresh_token=old-refresh"));

    assert.equal(response.cookies.get("access_token")?.value, "new-access");
    assert.equal(response.cookies.get("refresh_token")?.value, "new-refresh");
  });

  it("redireciona ao login quando o refresh falha", async () => {
    mockRefreshResponse(null);

    const response = await proxy(protectedRequest("refresh_token=revoked"));

    assert.equal(response.status, 307);
    assert.match(response.headers.get("location") ?? "", /\/login\?session=expired/);
  });
});
