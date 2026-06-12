import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import type { OrgUserRepository } from "../../domain/ports/org-user.repository.js";

export class GetUserByIdUseCase {
  constructor(private readonly orgUserRepository: OrgUserRepository) {}

  async execute(id: string, tenantId: string): Promise<OrgUser | null> {
    return this.orgUserRepository.findById(id, tenantId);
  }
}
