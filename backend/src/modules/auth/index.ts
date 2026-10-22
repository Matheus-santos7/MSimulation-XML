/**
 * API pública do contexto de auth para outros módulos. Não reexporta o `AuthModule` (o
 * `app.module.ts` importa pelo caminho dele), para o barrel não criar ciclo com o org.
 */
export { AuthError } from "./errors/auth.errors.js";
export { emailField, passwordField } from "./rules/credential.schemas.js";
export type {
  AccessTokenPayload,
  AuthMeta,
  AuthSessionResponse,
  LoginResponse,
  TwoFactorPendingPayload,
} from "./session/session.types.js";
export type { AuthUser, AuthUserWithTenant, TenantSummary } from "./user/user.types.js";
