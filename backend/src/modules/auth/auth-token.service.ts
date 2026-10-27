import { Inject, Injectable } from "@nestjs/common";
import type { FastifyInstance } from "fastify";
import {
  authSessionResponse,
  buildTwoFactorPendingPayload,
  twoFactorPendingResponse,
} from "../../lib/auth/session.js";
import { JWT } from "../../nest/tokens.js";
import { AuthSettings } from "./auth.settings.js";
import type {
  AccessTokenPayload,
  AuthSessionResponse,
  TwoFactorPendingPayload,
  TwoFactorPendingResponse,
} from "./session/session.types.js";
import type { AuthUser, AuthUserWithTenant } from "./user/user.types.js";

type Jwt = FastifyInstance["jwt"];

/**
 * JWTs do auth e as respostas que os carregam: access token da sessão e o token temporário
 * `2fa_pending` do login com 2FA (TTL próprio).
 */
@Injectable()
export class AuthTokenService {
  constructor(
    @Inject(JWT) private readonly jwt: Jwt,
    @Inject(AuthSettings) private readonly settings: AuthSettings,
  ) {}

  /** Resposta de sessão: perfil + access token assinado + refresh token opaco. */
  buildAuthSession(
    refreshToken: string,
    user: AuthUser,
    tenant: AuthUserWithTenant["tenant"],
    tokenVersion: number,
  ): AuthSessionResponse {
    return authSessionResponse(
      (payload) => this.signAccess(payload),
      this.settings.accessTokenTtl,
      refreshToken,
      user,
      tenant as Parameters<typeof authSessionResponse>[4],
      tokenVersion,
    ) as AuthSessionResponse;
  }

  /** Desafio do login com 2FA: token `2fa_pending` trocado por sessão em `/auth/login/verify-2fa`. */
  buildTwoFactorChallenge(user: Pick<AuthUser, "id" | "tokenVersion">): TwoFactorPendingResponse {
    const ttl = this.settings.twoFactorPendingTtl;
    // O `sign` do @fastify/jwt é tipado para o payload de acesso (`FastifyJWT.payload`).
    const sign = this.jwt.sign as unknown as (
      payload: TwoFactorPendingPayload,
      options: { expiresIn: string },
    ) => string;

    return twoFactorPendingResponse(
      sign(buildTwoFactorPendingPayload(user), { expiresIn: ttl }),
      ttl,
    );
  }

  /** Verifica assinatura e validade do token `2fa_pending`; lança se inválido ou expirado. */
  verifyTwoFactorPending(token: string): TwoFactorPendingPayload {
    return this.jwt.verify<TwoFactorPendingPayload>(token);
  }

  private signAccess(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload);
  }
}
