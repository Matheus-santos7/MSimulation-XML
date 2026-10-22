import { Inject, Injectable } from "@nestjs/common";
import { UserRepository } from "../../user/user.repository.js";

/** Indica se o 2FA está ativo para o usuário autenticado. */
@Injectable()
export class GetTwoFactorStatusUseCase {
  constructor(@Inject(UserRepository) private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<{ enabled: boolean }> {
    const status = await this.userRepository.findTotpStatus(userId);

    return { enabled: status?.totpEnabledAt != null };
  }
}
