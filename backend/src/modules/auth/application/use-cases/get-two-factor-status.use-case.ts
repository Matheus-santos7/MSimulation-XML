import type { UserRepository } from "../../domain/ports/user.repository.js";

/**
 * Indica se 2FA está ativo para o utilizador autenticado.
 *
 * @param userId - ID do JWT de acesso
 * @returns `{ enabled: boolean }`
 */
export class GetTwoFactorStatusUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<{ enabled: boolean }> {
    const status = await this.userRepository.findTotpStatus(userId);
    return { enabled: status?.totpEnabledAt != null };
  }
}
