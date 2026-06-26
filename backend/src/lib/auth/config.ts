import { BRAND_FULL_NAME } from "../brand.js";

/** Configuração central de autenticação (variáveis de ambiente). */

export const AUTH_GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos";

export function accessTokenTtl(): string {
  return process.env.JWT_ACCESS_EXPIRES_IN ?? "30m";
}

export function refreshTokenTtlMs(): number {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
  if (raw.endsWith("d")) return Number(raw.slice(0, -1)) * 24 * 60 * 60 * 1000;
  if (raw.endsWith("h")) return Number(raw.slice(0, -1)) * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const minLen = process.env.NODE_ENV === "production" ? 32 : 16;
  if (!secret || secret.length < minLen) {
    throw new Error(`JWT_SECRET deve ter pelo menos ${minLen} caracteres no .env`);
  }
  return secret;
}

export function requirePasswordPepper(): string {
  const pepper = process.env.PASSWORD_PEPPER;
  if (pepper && pepper.length >= 16) return pepper;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PASSWORD_PEPPER deve ter pelo menos 16 caracteres no .env");
  }
  return "dev-pepper-defina-PASSWORD_PEPPER-no-env";
}

/** Chave dedicada para criptografia AES dos segredos TOTP (independente do pepper). */
export function requireTotpEncryptionKey(): string {
  const key = process.env.TOTP_ENCRYPTION_KEY?.trim();
  if (key && key.length >= 32) return key;
  if (process.env.NODE_ENV === "production") {
    throw new Error("TOTP_ENCRYPTION_KEY deve ter ao menos 32 caracteres no .env");
  }
  return "dev-totp-key-defina-TOTP_ENCRYPTION_KEY-no-env";
}

export const PASSWORD_RESET_GENERIC_MESSAGE =
  "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha em instantes.";

export function passwordResetTtlMs(): number {
  const raw = process.env.PASSWORD_RESET_EXPIRES_IN ?? "1h";
  if (raw.endsWith("h")) return Number(raw.slice(0, -1)) * 60 * 60 * 1000;
  if (raw.endsWith("m")) return Number(raw.slice(0, -1)) * 60 * 1000;
  return 60 * 60 * 1000;
}

/** URL pública do frontend (links no e-mail). */
export function appPublicUrl(): string {
  const url = process.env.APP_PUBLIC_URL ?? process.env.FRONTEND_URL ?? "http://localhost:3000";
  const normalized = url.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production" && !normalized.startsWith("https://")) {
    throw new Error("APP_PUBLIC_URL deve usar HTTPS em produção");
  }
  return normalized;
}

export function resendApiKey(): string | undefined {
  const key = process.env.RESEND_API_KEY?.trim();
  return key && key.length > 0 ? key : undefined;
}

export function resendFromEmail(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ??
    `${BRAND_FULL_NAME} <onboarding@resend.dev>`
  );
}

export function loginMaxFailedAttempts(): number {
  const n = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS ?? "5");
  return Number.isFinite(n) && n >= 3 ? Math.floor(n) : 5;
}

export function loginLockoutMs(): number {
  const minutes = Number(process.env.LOGIN_LOCKOUT_MINUTES ?? "15");
  const m = Number.isFinite(minutes) && minutes >= 1 ? minutes : 15;
  return m * 60 * 1000;
}

export function twoFactorPendingTtl(): string {
  return process.env.TWO_FACTOR_PENDING_EXPIRES_IN ?? "5m";
}

export function turnstileSecretKey(): string | undefined {
  const key = process.env.TURNSTILE_SECRET_KEY?.trim();
  return key && key.length > 0 ? key : undefined;
}

/** Pré-lançamento: `REQUIRE_EMAIL_VERIFICATION=false`. No go-live, use `true`. */
export function requireEmailVerification(): boolean {
  const raw = process.env.REQUIRE_EMAIL_VERIFICATION?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  return true;
}

export function isEmailVerified(emailVerifiedAt: Date | null | undefined): boolean {
  if (!requireEmailVerification()) return true;
  return emailVerifiedAt != null;
}

export function emailVerificationTtlMs(): number {
  const raw = process.env.EMAIL_VERIFICATION_EXPIRES_IN ?? "24h";
  if (raw.endsWith("h")) return Number(raw.slice(0, -1)) * 60 * 60 * 1000;
  if (raw.endsWith("m")) return Number(raw.slice(0, -1)) * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

export const EMAIL_VERIFICATION_GENERIC_MESSAGE =
  "Se o e-mail estiver cadastrado, você receberá um link de verificação em instantes.";

/** Resposta genérica no registro — evita enumeração de contas existentes. */
export const REGISTER_GENERIC_FAILURE_MESSAGE =
  "Não foi possível concluir o cadastro. Verifique os dados informados ou entre na sua conta.";

export const TOTP_ISSUER = BRAND_FULL_NAME;
