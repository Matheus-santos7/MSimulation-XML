import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { assertProductionSecurityConfig } from "./production-env.js";

const ENV_KEYS = [
  "NODE_ENV",
  "JWT_SECRET",
  "PASSWORD_PEPPER",
  "TOTP_ENCRYPTION_KEY",
  "TURNSTILE_SECRET_KEY",
  "REQUIRE_EMAIL_VERIFICATION",
  "APP_PUBLIC_URL",
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(values: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("assertProductionSecurityConfig", () => {
  const original = snapshotEnv();

  afterEach(() => {
    restoreEnv(original);
  });

  it("ignora validação fora de produção", () => {
    process.env.NODE_ENV = "development";
    delete process.env.TURNSTILE_SECRET_KEY;
    assert.doesNotThrow(() => assertProductionSecurityConfig());
  });

  it("falha em produção sem TURNSTILE_SECRET_KEY", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.PASSWORD_PEPPER = "b".repeat(16);
    process.env.TOTP_ENCRYPTION_KEY = "c".repeat(32);
    process.env.REQUIRE_EMAIL_VERIFICATION = "true";
    process.env.APP_PUBLIC_URL = "https://app.example.com";
    delete process.env.TURNSTILE_SECRET_KEY;

    assert.throws(
      () => assertProductionSecurityConfig(),
      /TURNSTILE_SECRET_KEY é obrigatório em produção/,
    );
  });

  it("falha em produção com REQUIRE_EMAIL_VERIFICATION=false", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.PASSWORD_PEPPER = "b".repeat(16);
    process.env.TOTP_ENCRYPTION_KEY = "c".repeat(32);
    process.env.TURNSTILE_SECRET_KEY = "turnstile-secret-key";
    process.env.REQUIRE_EMAIL_VERIFICATION = "false";
    process.env.APP_PUBLIC_URL = "https://app.example.com";

    assert.throws(
      () => assertProductionSecurityConfig(),
      /REQUIRE_EMAIL_VERIFICATION deve ser true em produção/,
    );
  });
});
