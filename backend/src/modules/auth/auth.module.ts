import { Module } from "@nestjs/common";
import { AuthSettings } from "./auth.settings.js";
import { AuthTokenService } from "./auth-token.service.js";
import { EmailVerificationController } from "./email-verification/email-verification.controller.js";
import { EmailVerificationRepository } from "./email-verification/email-verification.repository.js";
import { ResendVerificationEmailUseCase } from "./email-verification/use-cases/resend-verification-email.usecase.js";
import { SendVerificationEmailUseCase } from "./email-verification/use-cases/send-verification-email.usecase.js";
import { VerifyEmailUseCase } from "./email-verification/use-cases/verify-email.usecase.js";
import { OnboardingController } from "./onboarding/onboarding.controller.js";
import { OnboardingRepository } from "./onboarding/onboarding.repository.js";
import { AttachTenantOnboardingUseCase } from "./onboarding/use-cases/attach-tenant-onboarding.usecase.js";
import { PasswordResetController } from "./password-reset/password-reset.controller.js";
import { PasswordResetRepository } from "./password-reset/password-reset.repository.js";
import { RequestPasswordResetUseCase } from "./password-reset/use-cases/request-password-reset.usecase.js";
import { ResetPasswordUseCase } from "./password-reset/use-cases/reset-password.usecase.js";
import { EmailSenderProvider } from "./providers/email-sender.provider.js";
import { LoginLockoutProvider } from "./providers/login-lockout.provider.js";
import { OpaqueTokenProvider } from "./providers/opaque-token.provider.js";
import { PasswordHasherProvider } from "./providers/password-hasher.provider.js";
import { TotpProvider } from "./providers/totp.provider.js";
import { RegistrationController } from "./registration/registration.controller.js";
import { RegisterUserUseCase } from "./registration/use-cases/register-user.usecase.js";
import { SessionController } from "./session/session.controller.js";
import { FinishLoginUseCase } from "./session/use-cases/finish-login.usecase.js";
import { GetCurrentUserUseCase } from "./session/use-cases/get-current-user.usecase.js";
import { InvalidateAllSessionsUseCase } from "./session/use-cases/invalidate-all-sessions.usecase.js";
import { LoginUseCase } from "./session/use-cases/login.usecase.js";
import { LogoutUseCase } from "./session/use-cases/logout.usecase.js";
import { RefreshSessionUseCase } from "./session/use-cases/refresh-session.usecase.js";
import { UserSessionRepository } from "./session/user-session.repository.js";
import { DisableTwoFactorUseCase } from "./two-factor/use-cases/disable-two-factor.usecase.js";
import { EnableTwoFactorUseCase } from "./two-factor/use-cases/enable-two-factor.usecase.js";
import { GetTwoFactorStatusUseCase } from "./two-factor/use-cases/get-two-factor-status.usecase.js";
import { SetupTwoFactorUseCase } from "./two-factor/use-cases/setup-two-factor.usecase.js";
import { VerifyTwoFactorLoginUseCase } from "./two-factor/use-cases/verify-two-factor-login.usecase.js";
import { TwoFactorController } from "./two-factor/two-factor.controller.js";
import { UserRepository } from "./user/user.repository.js";

/**
 * Contexto de autenticação. Uma pasta por feature:
 *
 * | Pasta | Rotas |
 * |-------|-------|
 * | `session/` | login, refresh, logout, me |
 * | `registration/` | register |
 * | `two-factor/` | login/verify-2fa, 2fa/status, setup, enable, disable |
 * | `password-reset/` | forgot-password, reset-password |
 * | `email-verification/` | verify-email, resend-verification |
 * | `onboarding/` | onboarding/tenant |
 *
 * `user/` e `providers/` são usados por várias features; `rules/` são regras puras.
 */
@Module({
  controllers: [
    SessionController,
    RegistrationController,
    TwoFactorController,
    PasswordResetController,
    EmailVerificationController,
    OnboardingController,
  ],
  providers: [
    AuthSettings,
    AuthTokenService,
    // providers
    EmailSenderProvider,
    LoginLockoutProvider,
    OpaqueTokenProvider,
    PasswordHasherProvider,
    TotpProvider,
    // repositories
    UserRepository,
    UserSessionRepository,
    PasswordResetRepository,
    EmailVerificationRepository,
    OnboardingRepository,
    // session
    FinishLoginUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    InvalidateAllSessionsUseCase,
    GetCurrentUserUseCase,
    // registration
    RegisterUserUseCase,
    // two-factor
    VerifyTwoFactorLoginUseCase,
    GetTwoFactorStatusUseCase,
    SetupTwoFactorUseCase,
    EnableTwoFactorUseCase,
    DisableTwoFactorUseCase,
    // password-reset
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    // email-verification
    SendVerificationEmailUseCase,
    ResendVerificationEmailUseCase,
    VerifyEmailUseCase,
    // onboarding
    AttachTenantOnboardingUseCase,
  ],
})
export class AuthModule {}
