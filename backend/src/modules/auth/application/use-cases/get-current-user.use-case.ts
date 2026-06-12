import type { AuthUserWithTenant } from "../../domain/entities/user.entity.js";
import type { UserRepository } from "../../domain/ports/user.repository.js";

export type GetCurrentUserResult = {
  user: AuthUserWithTenant;
  tenant: AuthUserWithTenant["tenant"];
};

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
