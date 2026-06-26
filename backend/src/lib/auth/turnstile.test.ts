import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { CaptchaVerificationError, verifyTurnstileToken } from "./turnstile.js";

describe("verifyTurnstileToken", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    fetchMock = mock.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    mock.restoreAll();
  });

  it("aceita ausência de token em desenvolvimento sem secret", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.TURNSTILE_SECRET_KEY;

    await verifyTurnstileToken(undefined);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it("rejeita token ausente quando secret está configurado", async () => {
    process.env.NODE_ENV = "production";

    await assert.rejects(() => verifyTurnstileToken(""), CaptchaVerificationError);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it("valida token sem enviar remoteip ao Cloudflare", async () => {
    process.env.NODE_ENV = "production";
    fetchMock.mock.mockImplementation(async () =>
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    await verifyTurnstileToken("0123456789abcdef");

    assert.equal(fetchMock.mock.callCount(), 1);
    const [url, init] = fetchMock.mock.calls[0]?.arguments as [string, RequestInit];
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(init.method, "POST");

    const body = init.body as URLSearchParams;
    assert.equal(body.get("secret"), "test-secret");
    assert.equal(body.get("response"), "0123456789abcdef");
    assert.equal(body.get("remoteip"), null);
  });

  it("rejeita quando Cloudflare retorna success=false", async () => {
    process.env.NODE_ENV = "production";
    fetchMock.mock.mockImplementation(async () =>
      new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), {
        status: 200,
      }),
    );

    await assert.rejects(
      () => verifyTurnstileToken("0123456789abcdef"),
      CaptchaVerificationError,
    );
  });
});
