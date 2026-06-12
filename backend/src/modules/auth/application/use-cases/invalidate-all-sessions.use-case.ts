import type { UserRepository } from "../../domain/ports/user.repository.js";
import type { UserSessionRepository } from "../../domain/ports/user-session.repository.js";

/**
 * Revoga todas as sessões e incrementa `tokenVersion` (logout forçado global).
 *
 * Usado após redefinição de senha para invalidar tokens antigos.
 *
 * @param userId - Utilizador afetado
 */
export class InvalidateAllSessionsUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userSessionRepository: UserSessionRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    await this.userSessionRepository.revokeAllForUser(userId);
    await this.userRepository.incrementTokenVersion(userId);
  }
}
