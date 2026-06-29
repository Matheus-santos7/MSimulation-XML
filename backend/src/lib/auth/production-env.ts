import { brevoApiKey, brevoSenderEmail } from "../brevo/config.js";
import {
  appPublicUrl,
  requireEmailVerification,
  requireJwtSecret,
  requirePasswordPepper,
  requireTotpEncryptionKey,
  turnstileSecretKey,
} from "./config.js";

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
  if (process.env.NODE_ENV !== "production") return;

  requireJwtSecret();
  requirePasswordPepper();
  requireTotpEncryptionKey();
  appPublicUrl();

  if (isPlaceholderSecret(process.env.JWT_SECRET)) {
    throw new Error("JWT_SECRET não pode usar valor placeholder em produção");
  }

  if (isPlaceholderSecret(process.env.PASSWORD_PEPPER)) {
    throw new Error("PASSWORD_PEPPER não pode usar valor placeholder em produção");
  }

  if (isPlaceholderSecret(process.env.TOTP_ENCRYPTION_KEY)) {
    throw new Error("TOTP_ENCRYPTION_KEY não pode usar valor placeholder em produção");
  }

  if (!turnstileSecretKey()) {
    throw new Error("TURNSTILE_SECRET_KEY é obrigatório em produção");
  }

  if (!requireEmailVerification()) {
    throw new Error("REQUIRE_EMAIL_VERIFICATION deve ser true em produção");
  }

  if (!brevoApiKey()) {
    throw new Error("BREVO_API_KEY é obrigatório em produção");
  }

  const senderEmail = brevoSenderEmail();
  if (!senderEmail || senderEmail === "noreply@example.com") {
    throw new Error("BREVO_SENDER_EMAIL deve ser um remetente verificado em produção");
  }
}
