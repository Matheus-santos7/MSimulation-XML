import { Injectable } from "@nestjs/common";
import {
  accessTokenTtl,
  appPublicUrl,
  EMAIL_VERIFICATION_GENERIC_MESSAGE,
  emailVerificationTtlMs,
  loginLockoutMs,
  loginMaxFailedAttempts,
  PASSWORD_RESET_GENERIC_MESSAGE,
  passwordResetTtlMs,
  refreshTokenTtlMs,
  REGISTER_GENERIC_FAILURE_MESSAGE,
  requireEmailVerification,
  twoFactorPendingTtl,
} from "../../lib/auth/config.js";

/**
 * Configuração do contexto de auth, lida na hora do uso (`lib/auth/config.ts` valida e aplica
 * defaults). Os use cases recebem esta classe; os testes passam um objeto com os mesmos campos.
 */
@Injectable()
export class AuthSettings {
  get appPublicUrl(): string {
    return appPublicUrl();
  }

  get requireEmailVerification(): boolean {
    return requireEmailVerification();
  }

  get accessTokenTtl(): string {
    return accessTokenTtl();
  }

  get refreshTokenTtlMs(): number {
    return refreshTokenTtlMs();
  }

  get twoFactorPendingTtl(): string {
    return twoFactorPendingTtl();
  }

  get passwordResetTtlMs(): number {
    return passwordResetTtlMs();
  }

  get emailVerificationTtlMs(): number {
    return emailVerificationTtlMs();
  }

  get loginMaxFailedAttempts(): number {
    return loginMaxFailedAttempts();
  }

  get loginLockoutMs(): number {
    return loginLockoutMs();
  }

  readonly registerGenericFailureMessage = REGISTER_GENERIC_FAILURE_MESSAGE;
  readonly passwordResetGenericMessage = PASSWORD_RESET_GENERIC_MESSAGE;
  readonly emailVerificationGenericMessage = EMAIL_VERIFICATION_GENERIC_MESSAGE;
}
