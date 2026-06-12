import type { UserRepository } from "../../domain/ports/user.repository.js";

export class GetTwoFactorStatusUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<{ enabled: boolean }> {
    const status = await this.userRepository.findTotpStatus(userId);
    return { enabled: status?.totpEnabledAt != null };
  }
}
