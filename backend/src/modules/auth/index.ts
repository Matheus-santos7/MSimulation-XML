/**
 * Bounded Context: Auth (authentication, sessions, MFA, onboarding).
 */
export type { AuthUser, AuthUserWithTenant, TenantSummary } from "./domain/entities/user.entity.js";
export type {
  AccessTokenPayload,
  AuthSessionResponse,
  LoginResponse,
  TwoFactorPendingPayload,
} from "./domain/entities/auth-session.entity.js";
export { AuthConflictError } from "./domain/errors/auth-conflict.error.js";
export { AuthStateError } from "./domain/errors/auth-state.error.js";
export { AuthUnauthorizedError, AUTH_GENERIC_LOGIN_ERROR } from "./domain/errors/auth-unauthorized.error.js";
export { AuthTooManyRequestsError } from "./domain/errors/auth-too-many-requests.error.js";
export { EmailDeliveryError } from "./domain/errors/email-delivery.error.js";
export { EmailVerificationInvalidError } from "./domain/errors/email-verification-invalid.error.js";
export { PasswordResetInvalidError } from "./domain/errors/password-reset-invalid.error.js";
export { TwoFactorRequiredError } from "./domain/errors/two-factor-required.error.js";
export type { AuthMeta } from "./domain/ports/session-response.port.js";
export { createAuthModule } from "./infrastructure/factory/auth-module.factory.js";
export { authController } from "./presentation/controllers/auth.controller.js";
export { onboardingController } from "./presentation/controllers/onboarding.controller.js";
export { handleAuthError } from "./presentation/mappers/auth-error.handler.js";
export { buildAuthMeta, signAccessToken } from "./presentation/helpers/auth-request.helper.js";
