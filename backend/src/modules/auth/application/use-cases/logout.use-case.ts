import type { RefreshTokenPort } from "../../domain/ports/refresh-token.port.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";
import type { UserSessionRepository } from "../../domain/ports/user-session.repository.js";

/**
 * Encerra sessão(ões) do utilizador.
 *
 * Com `refreshToken`: revoga apenas essa sessão.
 * Com `userId` (access token válido): revoga todas as sessões e incrementa `tokenVersion`.
 *
 * @param refreshToken - Opcional; refresh a invalidar
 * @param userId - Opcional; logout global de todas as sessões
 */
export class LogoutUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userSessionRepository: UserSessionRepository,
    private readonly refreshTokenPort: RefreshTokenPort,
  ) {}

  async execute(refreshToken?: string, userId?: string): Promise<void> {
    if (refreshToken) {
      await this.userSessionRepository.revokeByRefreshTokenHash(
        this.refreshTokenPort.hash(refreshToken),
      );
    }
    if (userId) {
      await this.userSessionRepository.revokeAllForUser(userId);
      await this.userRepository.incrementTokenVersion(userId);
    }
  }
}
