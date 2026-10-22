import {
  appPublicUrl,
  requireJwtSecret,
  requirePasswordPepper,
  requireTotpEncryptionKey,
  turnstileSecretKey,
} from "./config.js";
import { appConfig } from "../../config/config.service.js";

const PLACEHOLDER_SECRET_PATTERNS = [
  /^change-me/i,
  /^defina-/i,
  /^dev-pepper/i,
  /^dev-totp-key/i,
];

function isPlaceholderSecret(value: string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_SECRET_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Valida variáveis críticas de segurança antes do boot em produção.
 * Falha cedo para evitar deploy com CAPTCHA, e-mail ou segredos fracos.
 */
export function assertProductionSecurityConfig(): void {
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
