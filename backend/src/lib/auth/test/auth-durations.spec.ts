import assert from "node:assert/strict";
import { afterEach, describe, it } from "vitest";
import {
  emailVerificationTtlMs,
  parseDurationMs,
  passwordResetTtlMs,
  refreshTokenTtlMs,
} from "../config.js";
import { assertAuthDurations } from "../production-env.js";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const FALLBACK = 123;

describe("parseDurationMs", () => {
  it.each([
    ["15m", 15 * MINUTE],
    ["30m", 30 * MINUTE],
    ["3600s", HOUR],
    ["7d", 7 * DAY],
    ["12h", 12 * HOUR],
  ])("converte %s para milissegundos", (raw, expected) => {
    assert.equal(parseDurationMs("X", raw, FALLBACK), expected);
  });

  it("usa o padrão quando a variável está ausente", () => {
    assert.equal(parseDurationMs("X", undefined, FALLBACK), FALLBACK);
  });

  it("aceita o teto de 365 dias e rejeita acima dele ou número gigante", () => {
    // Sem teto, "99999999999999999d" passava no regex, virava ~8,6e24 ms e `Date.now() + ttl`
    // gerava Invalid Date só no primeiro login, em vez de falhar no deploy.
    assert.equal(parseDurationMs("X", "365d", FALLBACK), 365 * DAY);
    assert.throws(() => parseDurationMs("JWT_REFRESH_EXPIRES_IN", "366d", FALLBACK), /JWT_REFRESH_EXPIRES_IN/);
    assert.throws(
      () => parseDurationMs("JWT_REFRESH_EXPIRES_IN", "99999999999999999d", FALLBACK),
      /JWT_REFRESH_EXPIRES_IN/,
    );
  });

  it.each(["abc", "", "0m", "-5m", "1.5h", "10", "5w"])("rejeita %j", (raw) => {
    assert.throws(
      () => parseDurationMs("JWT_REFRESH_EXPIRES_IN", raw, FALLBACK),
      /JWT_REFRESH_EXPIRES_IN/,
    );
  });
});

describe("TTLs de autenticação", () => {
  const keys = [
    "JWT_REFRESH_EXPIRES_IN",
    "PASSWORD_RESET_EXPIRES_IN",
    "EMAIL_VERIFICATION_EXPIRES_IN",
    "TWO_FACTOR_PENDING_EXPIRES_IN",
  ] as const;
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("mantém os padrões quando ausentes", () => {
    for (const key of keys) delete process.env[key];
    assert.equal(refreshTokenTtlMs(), 7 * DAY);
    assert.equal(passwordResetTtlMs(), HOUR);
    assert.equal(emailVerificationTtlMs(), 24 * HOUR);
  });

  it("aceita minutos no refresh em vez de cair em 7 dias", () => {
    process.env.JWT_REFRESH_EXPIRES_IN = "15m";
    assert.equal(refreshTokenTtlMs(), 15 * MINUTE);
  });

  it("assertAuthDurations também valida o TTL do 2FA pendente no startup", () => {
    // Esse valor vai como string para o @fastify/jwt e antes só falhava no 1º login com 2FA.
    process.env.TWO_FACTOR_PENDING_EXPIRES_IN = "abc";
    assert.throws(() => assertAuthDurations(), /TWO_FACTOR_PENDING_EXPIRES_IN/);
  });

  it("assertAuthDurations falha no startup com TTL inválido", () => {
    process.env.PASSWORD_RESET_EXPIRES_IN = "abc";
    assert.throws(() => assertAuthDurations(), /PASSWORD_RESET_EXPIRES_IN/);
  });
});
