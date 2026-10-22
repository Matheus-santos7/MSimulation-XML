/**
 * Único leitor de `process.env` no backend. Cada variável é um getter lido na hora do acesso
 * (testes alteram o ambiente entre casos). Validação e defaults de cada área continuam nos
 * respectivos `config.ts` (`lib/auth/config.ts`, `lib/brevo/config.ts`...).
 */
export class ConfigService {
  private get(name: string): string | undefined {
    return process.env[name];
  }

  get nodeEnv(): string | undefined {
    return this.get("NODE_ENV");
  }

  get isProduction(): boolean {
    return this.nodeEnv === "production";
  }

  // Servidor
  get port(): string | undefined {
    return this.get("PORT");
  }

  get host(): string | undefined {
    return this.get("HOST");
  }

  get trustProxy(): string | undefined {
    return this.get("TRUST_PROXY");
  }

  get corsOrigins(): string | undefined {
    return this.get("CORS_ORIGINS");
  }

  // Banco
  get databaseUrl(): string | undefined {
    return this.get("DATABASE_URL");
  }

  // Autenticação
  get jwtSecret(): string | undefined {
    return this.get("JWT_SECRET");
  }

  get jwtAccessExpiresIn(): string | undefined {
    return this.get("JWT_ACCESS_EXPIRES_IN");
  }

  get jwtRefreshExpiresIn(): string | undefined {
    return this.get("JWT_REFRESH_EXPIRES_IN");
  }

  get passwordPepper(): string | undefined {
    return this.get("PASSWORD_PEPPER");
  }

  get totpEncryptionKey(): string | undefined {
    return this.get("TOTP_ENCRYPTION_KEY");
  }

  get passwordResetExpiresIn(): string | undefined {
    return this.get("PASSWORD_RESET_EXPIRES_IN");
  }

  get appPublicUrl(): string | undefined {
    return this.get("APP_PUBLIC_URL");
  }

  get frontendUrl(): string | undefined {
    return this.get("FRONTEND_URL");
  }

  get loginMaxFailedAttempts(): string | undefined {
    return this.get("LOGIN_MAX_FAILED_ATTEMPTS");
  }

  get loginLockoutMinutes(): string | undefined {
    return this.get("LOGIN_LOCKOUT_MINUTES");
  }

  get twoFactorPendingExpiresIn(): string | undefined {
    return this.get("TWO_FACTOR_PENDING_EXPIRES_IN");
  }

  get turnstileSecretKey(): string | undefined {
    return this.get("TURNSTILE_SECRET_KEY");
  }

  get requireEmailVerification(): string | undefined {
    return this.get("REQUIRE_EMAIL_VERIFICATION");
  }

  get emailVerificationExpiresIn(): string | undefined {
    return this.get("EMAIL_VERIFICATION_EXPIRES_IN");
  }

  // E-mail (Brevo)
  get brevoApiKey(): string | undefined {
    return this.get("BREVO_API_KEY");
  }

  get brevoSenderEmail(): string | undefined {
    return this.get("BREVO_SENDER_EMAIL");
  }

  get brevoSenderName(): string | undefined {
    return this.get("BREVO_SENDER_NAME");
  }

  // Validador fiscal
  get fiscalValidatorUrl(): string | undefined {
    return this.get("FISCAL_VALIDATOR_URL");
  }

  get fiscalValidatorHostPort(): string | undefined {
    return this.get("FISCAL_VALIDATOR_HOSTPORT");
  }

  get fiscalValidatorEnabled(): string | undefined {
    return this.get("FISCAL_VALIDATOR_ENABLED");
  }
}

/** Instância usada pelo código fora do container Nest (`lib/`, bootstrap). */
export const appConfig = new ConfigService();
