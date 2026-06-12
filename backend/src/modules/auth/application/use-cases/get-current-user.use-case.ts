import type { AuthUserWithTenant } from "../../domain/entities/user.entity.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";

/** Resultado de `/auth/me` com utilizador e tenant desnormalizado. */
export type GetCurrentUserResult = {
  user: AuthUserWithTenant;
  tenant: AuthUserWithTenant["tenant"];
};

/**
 * Obtém perfil do utilizador autenticado para `/auth/me`.
 *
 * @param userId - ID extraído do JWT de acesso
 * @returns Utilizador com tenant ou `null` se não existir
 */
export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<GetCurrentUserResult | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) return null;

    return {
      user,
      tenant: user.tenant,
    };
  }
}
