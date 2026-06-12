import type {
  AccessTokenPayload,
  AuthSessionResponse,
  LoginResponse,
  TwoFactorPendingPayload,
  TwoFactorPendingResponse,
} from "../entities/auth-session.entity.js";
import type { AuthUser, AuthUserWithTenant } from "../entities/user.entity.js";

export type AuthMeta = {
  userAgent?: string;
  ipAddress?: string;
};

export type SignAccessToken = (payload: AccessTokenPayload) => string;
export type SignTwoFactorPendingToken = (payload: TwoFactorPendingPayload) => string;

export interface SessionResponsePort {
  buildAuthSession(
    signAccess: SignAccessToken,
    refreshToken: string,
    user: AuthUser,
    tenant: AuthUserWithTenant["tenant"],
    tokenVersion: number,
  ): AuthSessionResponse;
  buildTwoFactorPending(
    signTwoFactorPending: SignTwoFactorPendingToken,
    user: Pick<AuthUser, "id" | "tokenVersion">,
  ): TwoFactorPendingResponse;
  buildLoginTwoFactorChallenge(
    signTwoFactorPending: SignTwoFactorPendingToken,
    user: Pick<AuthUser, "id" | "tokenVersion">,
  ): LoginResponse;
}
