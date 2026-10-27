import { Inject, Injectable } from "@nestjs/common";
import { AuthSettings } from "../../auth.settings.js";
import { AuthTokenService } from "../../auth-token.service.js";
import { AuthError } from "../../errors/auth.errors.js";
import { OpaqueTokenProvider } from "../../providers/opaque-token.provider.js";
import { UserRepository } from "../../user/user.repository.js";
import type { AuthMeta, AuthSessionResponse } from "../session.types.js";
import { UserSessionRepository } from "../user-session.repository.js";

const USER_AGENT_MAX_LENGTH = 512;
const IP_ADDRESS_MAX_LENGTH = 64;

/**
 * Finaliza autenticação: cria sessão com refresh token e monta resposta com access JWT.
 *
 * Usado após login, 2FA, registro, refresh rotacionado e onboarding.
 *
 * @throws {AuthError.Unauthorized} Usuário não encontrado
 */
@Injectable()
export class FinishLoginUseCase {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(UserSessionRepository) private readonly userSessionRepository: UserSessionRepository,
    @Inject(OpaqueTokenProvider) private readonly tokens: OpaqueTokenProvider,
    @Inject(AuthTokenService) private readonly authTokens: AuthTokenService,
    @Inject(AuthSettings) private readonly settings: AuthSettings,
  ) {}

  async execute(userId: string, meta: AuthMeta): Promise<AuthSessionResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AuthError.Unauthorized();
    }

    const refreshToken = await this.createSession(userId, meta);

    return this.authTokens.buildAuthSession(refreshToken, user, user.tenant, user.tokenVersion);
  }

  private async createSession(userId: string, meta: AuthMeta): Promise<string> {
    const refreshToken = this.tokens.generateRefreshToken();
    const expiresAt = new Date(Date.now() + this.settings.refreshTokenTtlMs);
    await this.userSessionRepository.createSession({
      userId,
      refreshTokenHash: this.tokens.hashRefreshToken(refreshToken),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, USER_AGENT_MAX_LENGTH),
      ipAddress: meta.ipAddress?.slice(0, IP_ADDRESS_MAX_LENGTH),
    });

    return refreshToken;
  }
}
