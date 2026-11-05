import { BRAND_FULL_NAME } from "../brand.js";
import { appConfig } from "../../config/config.service.js";

/** Configuração central de autenticação (variáveis de ambiente). */

export const AUTH_GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos";

export function accessTokenTtl(): string {
  return appConfig.jwtAccessExpiresIn ?? "30m";
}

const DURATION_UNIT_MS: Readonly<Record<string, number>> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};
const DURATION_PATTERN = /^([1-9]\d*)([smhd])$/;

/** Maior duração aceita em qualquer TTL de autenticação (sessão de mais de 1 ano é erro de digitação). */
const MAX_DURATION_MS = 365 * DURATION_UNIT_MS.d;

const DEFAULT_REFRESH_TTL_MS = 7 * DURATION_UNIT_MS.d;
const DEFAULT_PASSWORD_RESET_TTL_MS = DURATION_UNIT_MS.h;
const DEFAULT_EMAIL_VERIFICATION_TTL_MS = 24 * DURATION_UNIT_MS.h;

/**
 * Converte uma duração de variável de ambiente ("15m", "12h", "7d", "3600s") em milissegundos.
 *
 * Variável ausente usa `fallbackMs`. Variável presente e inválida LANÇA erro: antes, valores
 * fora do formato caíam em silêncio no padrão (ex.: "15m" virava 7 dias), e a sessão durava
 * mais do que o configurado sem nenhum aviso.
 *
 * Formato: inteiro positivo + unidade. Para aceitar uma unidade nova, acrescente-a em
 * `DURATION_UNIT_MS` e em `DURATION_PATTERN`.
 */
export function parseDurationMs(
  variableName: string,
  raw: string | undefined,
  fallbackMs: number,
): number {
  if (raw === undefined) return fallbackMs;

  const match = DURATION_PATTERN.exec(raw.trim());
  if (!match) {
    throw new Error(
      `${variableName} inválida ("${raw}"): use um inteiro positivo seguido de s, m, h ou d (ex.: 15m, 12h, 7d)`,
    );
  }

  const durationMs = Number(match[1]) * DURATION_UNIT_MS[match[2]];
  // Teto: um número gigante passa no regex, mas estoura Date e falharia só no 1º login.
  if (!Number.isSafeInteger(durationMs) || durationMs > MAX_DURATION_MS) {
    throw new Error(`${variableName} inválida ("${raw}"): o máximo permitido é 365d`);
  }

  return durationMs;
}

export function refreshTokenTtlMs(): number {
  return parseDurationMs(
    "JWT_REFRESH_EXPIRES_IN",
    appConfig.jwtRefreshExpiresIn,
    DEFAULT_REFRESH_TTL_MS,
  );
}

export function requireJwtSecret(): string {
  const secret = appConfig.jwtSecret;
  const minLen = appConfig.isProduction ? 32 : 16;
  if (!secret || secret.length < minLen) {
    throw new Error(`JWT_SECRET deve ter pelo menos ${minLen} caracteres no .env`);
  }
  return secret;
}

export function requirePasswordPepper(): string {
  const pepper = appConfig.passwordPepper;
  if (pepper && pepper.length >= 16) return pepper;
  if (appConfig.isProduction) {
    throw new Error("PASSWORD_PEPPER deve ter pelo menos 16 caracteres no .env");
  }
  return "dev-pepper-defina-PASSWORD_PEPPER-no-env";
}

/** Chave dedicada para criptografia AES dos segredos TOTP (independente do pepper). */
export function requireTotpEncryptionKey(): string {
  const key = appConfig.totpEncryptionKey?.trim();
  if (key && key.length >= 32) return key;
  if (appConfig.isProduction) {
    throw new Error("TOTP_ENCRYPTION_KEY deve ter ao menos 32 caracteres no .env");
  }
  return "dev-totp-key-defina-TOTP_ENCRYPTION_KEY-no-env";
}

export const PASSWORD_RESET_GENERIC_MESSAGE =
  "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha em instantes.";

export function passwordResetTtlMs(): number {
  return parseDurationMs(
    "PASSWORD_RESET_EXPIRES_IN",
    appConfig.passwordResetExpiresIn,
    DEFAULT_PASSWORD_RESET_TTL_MS,
  );
}

/** URL pública do frontend (links no e-mail). */
export function appPublicUrl(): string {
  const url = appConfig.appPublicUrl ?? appConfig.frontendUrl ?? "http://localhost:3000";
  const normalized = url.replace(/\/$/, "");
  if (appConfig.isProduction && !normalized.startsWith("https://")) {
    throw new Error("APP_PUBLIC_URL deve usar HTTPS em produção");
  }
  return normalized;
}

export function loginMaxFailedAttempts(): number {
  const n = Number(appConfig.loginMaxFailedAttempts ?? "5");
  return Number.isFinite(n) && n >= 3 ? Math.floor(n) : 5;
}

export function loginLockoutMs(): number {
  const minutes = Number(appConfig.loginLockoutMinutes ?? "15");
  const m = Number.isFinite(minutes) && minutes >= 1 ? minutes : 15;
  return m * 60 * 1000;
}

export function twoFactorPendingTtl(): string {
  return appConfig.twoFactorPendingExpiresIn ?? "5m";
}

export function turnstileSecretKey(): string | undefined {
  const key = appConfig.turnstileSecretKey?.trim();
  return key && key.length > 0 ? key : undefined;
}

/** Pré-lançamento: `REQUIRE_EMAIL_VERIFICATION=false`. No go-live, use `true`. */
export function requireEmailVerification(): boolean {
  const raw = appConfig.requireEmailVerification?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  return true;
}

export function isEmailVerified(emailVerifiedAt: Date | null | undefined): boolean {
  if (!requireEmailVerification()) return true;
  return emailVerifiedAt != null;
}

export function emailVerificationTtlMs(): number {
  return parseDurationMs(
    "EMAIL_VERIFICATION_EXPIRES_IN",
    appConfig.emailVerificationExpiresIn,
    DEFAULT_EMAIL_VERIFICATION_TTL_MS,
  );
}

export const EMAIL_VERIFICATION_GENERIC_MESSAGE =
  "Se o e-mail estiver cadastrado, você receberá um link de verificação em instantes.";

/** Resposta genérica no registro — evita enumeração de contas existentes. */
export const REGISTER_GENERIC_FAILURE_MESSAGE =
  "Não foi possível concluir o cadastro. Verifique os dados informados ou entre na sua conta.";

export const TOTP_ISSUER = BRAND_FULL_NAME;
