import { UserForbiddenError } from "../../domain/errors/user-forbidden.error.js";
import type { OrgUserRepository } from "../../domain/ports/org-user.repository.js";

export class DeleteUserUseCase {
  constructor(private readonly orgUserRepository: OrgUserRepository) {}

  async execute(id: string, tenantId: string, currentUserId: string): Promise<boolean> {
    const existing = await this.orgUserRepository.findById(id, tenantId);
    if (!existing) return false;

    if (existing.id === currentUserId) {
      throw new UserForbiddenError("Não é possível excluir o usuário logado");
    }

    const userCount = await this.orgUserRepository.countByTenant(tenantId);
    if (userCount <= 1) {
      throw new UserForbiddenError("A empresa precisa ter ao menos um usuário");
    }

    await this.orgUserRepository.delete(id);
    return true;
  }
}
