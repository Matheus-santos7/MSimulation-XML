import { Inject, Injectable } from "@nestjs/common";
import { UserRepository } from "../../user/user.repository.js";
import { UserSessionRepository } from "../user-session.repository.js";

/** Revoga todas as sessões e incrementa `tokenVersion` (usado depois de redefinir a senha). */
@Injectable()
export class InvalidateAllSessionsUseCase {
  constructor(
    @Inject(UserRepository) private readonly userRepository: UserRepository,
    @Inject(UserSessionRepository) private readonly userSessionRepository: UserSessionRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    await this.userSessionRepository.revokeAllForUser(userId);
    await this.userRepository.incrementTokenVersion(userId);
  }
}
