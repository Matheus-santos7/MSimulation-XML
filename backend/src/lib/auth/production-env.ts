import {
  appPublicUrl,
  emailVerificationTtlMs,
  parseDurationMs,
  passwordResetTtlMs,
  refreshTokenTtlMs,
  requireJwtSecret,
  requirePasswordPepper,
  requireTotpEncryptionKey,
  turnstileSecretKey,
  twoFactorPendingTtl,
} from "./config.js";
import { appConfig } from "../../config/config.service.js";

const PLACEHOLDER_SECRET_PATTERNS = [/^change-me/i, /^defina-/i, /^dev-pepper/i, /^dev-totp-key/i];

function isPlaceholderSecret(value: string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_SECRET_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Valida os TTLs de sessão/token no boot, em qualquer ambiente. Cada getter lança se a
 * variável estiver presente e inválida; sem esta chamada o erro só apareceria no primeiro
 * login ou e-mail enviado, e não no deploy.
 */
export function assertAuthDurations(): void {
  refreshTokenTtlMs();
  passwordResetTtlMs();
  emailVerificationTtlMs();
  // O TTL do 2FA pendente segue como string para o @fastify/jwt; aqui só validamos o formato
  // (o valor de retorno é descartado) para que o erro apareça no deploy e não no 1º login com 2FA.
  parseDurationMs("TWO_FACTOR_PENDING_EXPIRES_IN", twoFactorPendingTtl(), 0);
}

/**
 * Valida variáveis críticas de segurança antes do boot em produção.
 * Falha cedo para evitar deploy com CAPTCHA, e-mail ou segredos fracos.
 * Os TTLs de autenticação são validados também fora de produção.
 */
export function assertProductionSecurityConfig(): void {
  assertAuthDurations();

  if (!appConfig.isProduction) return;

  requireJwtSecret();
  requirePasswordPepper();
  requireTotpEncryptionKey();
  appPublicUrl();

  if (isPlaceholderSecret(appConfig.jwtSecret)) {
    throw new Error("JWT_SECRET não pode usar valor placeholder em produção");
  }

  if (isPlaceholderSecret(appConfig.passwordPepper)) {
    throw new Error("PASSWORD_PEPPER não pode usar valor placeholder em produção");
  }

  if (isPlaceholderSecret(appConfig.totpEncryptionKey)) {
    throw new Error("TOTP_ENCRYPTION_KEY não pode usar valor placeholder em produção");
  }

  if (!turnstileSecretKey()) {
    throw new Error("TURNSTILE_SECRET_KEY é obrigatório em produção");
  }
}
