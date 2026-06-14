import {
  appPublicUrl,
  EMAIL_VERIFICATION_GENERIC_MESSAGE,
  PASSWORD_RESET_GENERIC_MESSAGE,
  emailVerificationTtlMs,
  passwordResetTtlMs,
  refreshTokenTtlMs,
  requireEmailVerification,
} from "../../../../lib/auth/config.js";
import {
  generateEmailVerificationToken,
  hashEmailVerificationToken,
} from "../../../../lib/auth/email-verification-token.js";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from "../../../../lib/auth/password-reset-token.js";
import { AttachTenantOnboardingUseCase } from "../../application/use-cases/attach-tenant-onboarding.use-case.js";
import { DisableTwoFactorUseCase } from "../../application/use-cases/disable-two-factor.use-case.js";
import { EnableTwoFactorUseCase } from "../../application/use-cases/enable-two-factor.use-case.js";
import { FinishLoginUseCase } from "../../application/use-cases/finish-login.use-case.js";
import { GetCurrentUserUseCase } from "../../application/use-cases/get-current-user.use-case.js";
import { GetTwoFactorStatusUseCase } from "../../application/use-cases/get-two-factor-status.use-case.js";
import { InvalidateAllSessionsUseCase } from "../../application/use-cases/invalidate-all-sessions.use-case.js";
import { LoginUseCase } from "../../application/use-cases/login.use-case.js";
import { LogoutUseCase } from "../../application/use-cases/logout.use-case.js";
import { RefreshSessionUseCase } from "../../application/use-cases/refresh-session.use-case.js";
import { RegisterUserUseCase } from "../../application/use-cases/register-user.use-case.js";
import { RequestPasswordResetUseCase } from "../../application/use-cases/request-password-reset.use-case.js";
import { ResendVerificationEmailUseCase } from "../../application/use-cases/resend-verification-email.use-case.js";
import { ResetPasswordUseCase } from "../../application/use-cases/reset-password.use-case.js";
import { SendVerificationEmailUseCase } from "../../application/use-cases/send-verification-email.use-case.js";
import { SetupTwoFactorUseCase } from "../../application/use-cases/setup-two-factor.use-case.js";
import { VerifyEmailUseCase } from "../../application/use-cases/verify-email.use-case.js";
import { VerifyTwoFactorLoginUseCase } from "../../application/use-cases/verify-two-factor-login.use-case.js";
import { LoginLockoutAdapter } from "../external/login-lockout.adapter.js";
import { PasswordHasherAdapter } from "../external/password-hasher.adapter.js";
import { RefreshTokenAdapter } from "../external/refresh-token.adapter.js";
import { ResendEmailAdapter } from "../external/resend-email.adapter.js";
import { SessionResponseAdapter } from "../external/session-response.adapter.js";
import { TotpAdapter } from "../external/totp.adapter.js";
import { PrismaEmailVerificationRepository } from "../prisma/prisma-email-verification.repository.js";
import { PrismaOnboardingRepository } from "../prisma/prisma-onboarding.repository.js";
import { PrismaPasswordResetRepository } from "../prisma/prisma-password-reset.repository.js";
import { PrismaUserSessionRepository } from "../prisma/prisma-user-session.repository.js";
import { PrismaUserRepository } from "../prisma/prisma-user.repository.js";

/** Composition root for the Auth module. */
export function createAuthModule() {
  const userRepository = new PrismaUserRepository();
  const userSessionRepository = new PrismaUserSessionRepository();
  const emailVerificationRepository = new PrismaEmailVerificationRepository();
  const passwordResetRepository = new PrismaPasswordResetRepository();
  const onboardingRepository = new PrismaOnboardingRepository();

  const passwordHasher = new PasswordHasherAdapter();
  const refreshTokenPort = new RefreshTokenAdapter();
  const sessionResponse = new SessionResponseAdapter();
  const emailSender = new ResendEmailAdapter();
  const loginLockout = new LoginLockoutAdapter();
  const totp = new TotpAdapter();

  const finishLogin = new FinishLoginUseCase(
    userRepository,
    userSessionRepository,
    refreshTokenPort,
    sessionResponse,
    refreshTokenTtlMs(),
  );
  const invalidateAllSessions = new InvalidateAllSessionsUseCase(userRepository, userSessionRepository);

  const sendVerificationEmail = new SendVerificationEmailUseCase(
    userRepository,
    emailVerificationRepository,
    emailSender,
    {
      appPublicUrl: appPublicUrl(),
      emailVerificationTtlMs: emailVerificationTtlMs(),
      requireEmailVerification: requireEmailVerification(),
      generateToken: generateEmailVerificationToken,
      hashToken: hashEmailVerificationToken,
    },
  );

  return {
    registerUser: new RegisterUserUseCase(userRepository, finishLogin, sendVerificationEmail, passwordHasher, {
      requireEmailVerification: requireEmailVerification(),
    }),
    login: new LoginUseCase(userRepository, passwordHasher, loginLockout, sessionResponse, finishLogin),
    refreshSession: new RefreshSessionUseCase(
      userSessionRepository,
      refreshTokenPort,
      passwordHasher,
      finishLogin,
    ),
    logout: new LogoutUseCase(userRepository, userSessionRepository, refreshTokenPort),
    getCurrentUser: new GetCurrentUserUseCase(userRepository),
    finishLogin,
    invalidateAllSessions,
    requestPasswordReset: new RequestPasswordResetUseCase(
      userRepository,
      passwordResetRepository,
      emailSender,
      passwordHasher,
      {
        appPublicUrl: appPublicUrl(),
        passwordResetTtlMs: passwordResetTtlMs(),
        genericMessage: PASSWORD_RESET_GENERIC_MESSAGE,
        generateToken: generatePasswordResetToken,
        hashToken: hashPasswordResetToken,
      },
    ),
    resetPassword: new ResetPasswordUseCase(
      passwordResetRepository,
      userRepository,
      passwordHasher,
      loginLockout,
      totp,
      invalidateAllSessions,
      { hashToken: hashPasswordResetToken },
    ),
    sendVerificationEmail,
    verifyEmail: new VerifyEmailUseCase(emailVerificationRepository, {
      hashToken: hashEmailVerificationToken,
    }),
    resendVerificationEmail: new ResendVerificationEmailUseCase(sendVerificationEmail, {
      requireEmailVerification: requireEmailVerification(),
      genericMessage: EMAIL_VERIFICATION_GENERIC_MESSAGE,
    }),
    verifyTwoFactorLogin: new VerifyTwoFactorLoginUseCase(
      userRepository,
      loginLockout,
      totp,
      finishLogin,
    ),
    getTwoFactorStatus: new GetTwoFactorStatusUseCase(userRepository),
    setupTwoFactor: new SetupTwoFactorUseCase(userRepository, totp),
    enableTwoFactor: new EnableTwoFactorUseCase(userRepository, totp),
    disableTwoFactor: new DisableTwoFactorUseCase(userRepository, passwordHasher, totp),
    attachTenantOnboarding: new AttachTenantOnboardingUseCase(onboardingRepository, finishLogin, {
      requireEmailVerification: requireEmailVerification(),
    }),
  };
}
