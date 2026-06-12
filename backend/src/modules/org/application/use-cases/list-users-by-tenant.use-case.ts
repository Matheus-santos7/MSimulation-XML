import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import type { OrgUserRepository } from "../../domain/ports/org-user.repository.js";

export class ListUsersByTenantUseCase {
  constructor(private readonly orgUserRepository: OrgUserRepository) {}

  async execute(tenantId: string): Promise<OrgUser[]> {
    return this.orgUserRepository.listByTenant(tenantId);
  }
}
