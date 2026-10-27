import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { isEmailVerified } from "../../../../lib/auth/config.js";
import { UserRepository } from "../../user/user.repository.js";
import type { AuthUserResponse } from "../session.types.js";

/**
 * Perfil do usuário autenticado (`/auth/me`), com o tenant desnormalizado.
 *
 * @throws {NotFoundException} Usuário não encontrado
 */
@Injectable()
export class GetCurrentUserUseCase {
  constructor(@Inject(UserRepository) private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<AuthUserResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundException("Usuário não encontrado");

    return {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name ?? undefined,
      tenant: user.tenant,
      needsOnboarding: user.tenantId === null,
      twoFactorEnabled: user.totpEnabledAt != null,
      emailVerified: isEmailVerified(user.emailVerifiedAt),
      role: user.role,
    };
  }
}
