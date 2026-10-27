import { Inject, Injectable } from "@nestjs/common";
import { OpaqueTokenProvider } from "../../providers/opaque-token.provider.js";
import { UserRepository } from "../../user/user.repository.js";
import { UserSessionRepository } from "../user-session.repository.js";

/**
 * Encerra sessões.
 *
 * Com `refreshToken`: revoga só essa sessão. Com `userId` (access token válido): revoga todas e
 * incrementa `tokenVersion`, invalidando os access tokens já emitidos.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(UserSessionRepository) private readonly userSessionRepository: UserSessionRepository,
    @Inject(OpaqueTokenProvider) private readonly tokens: OpaqueTokenProvider,
  ) {}

  async execute(refreshToken?: string, userId?: string): Promise<void> {
    if (refreshToken) {
      await this.userSessionRepository.revokeByRefreshTokenHash(
        this.tokens.hashRefreshToken(refreshToken),
      );
    }
    if (userId) {
      await this.userSessionRepository.revokeAllForUser(userId);
      await this.userRepository.incrementTokenVersion(userId);
    }
  }
}
