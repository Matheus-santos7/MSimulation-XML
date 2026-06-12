import { accessTokenTtl, twoFactorPendingTtl } from "../../../../lib/auth/config.js";
import {
  authSessionResponse,
  buildTwoFactorPendingPayload,
  twoFactorPendingResponse,
} from "../../../../lib/auth/session.js";
import type {
  AuthSessionResponse,
  LoginResponse,
  TwoFactorPendingResponse,
} from "../../domain/entities/auth-session.entity.js";
import type {
  SessionResponsePort,
  SignAccessToken,
  SignTwoFactorPendingToken,
} from "../../domain/ports/session-response.port.js";
import type { AuthUser, AuthUserWithTenant } from "../../domain/entities/user.entity.js";

export class SessionResponseAdapter implements SessionResponsePort {
  buildAuthSession(
    signAccess: SignAccessToken,
    refreshToken: string,
    user: AuthUser,
    tenant: AuthUserWithTenant["tenant"],
    tokenVersion: number,
  ): AuthSessionResponse {
    return authSessionResponse(
      signAccess,
      accessTokenTtl(),
      refreshToken,
      user,
      tenant as Parameters<typeof authSessionResponse>[4],
      tokenVersion,
    ) as AuthSessionResponse;
  }

  buildTwoFactorPending(
    signTwoFactorPending: SignTwoFactorPendingToken,
    user: Pick<AuthUser, "id" | "tokenVersion">,
  ): TwoFactorPendingResponse {
    const token = signTwoFactorPending(buildTwoFactorPendingPayload(user));
    return twoFactorPendingResponse(token, twoFactorPendingTtl());
  }

  buildLoginTwoFactorChallenge(
    signTwoFactorPending: SignTwoFactorPendingToken,
    user: Pick<AuthUser, "id" | "tokenVersion">,
  ): LoginResponse {
    return this.buildTwoFactorPending(signTwoFactorPending, user);
  }
}
