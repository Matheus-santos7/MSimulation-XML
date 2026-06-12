import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import type { OrgUserRepository } from "../../domain/ports/org-user.repository.js";

/**
 * Lista todos os utilizadores vinculados ao tenant.
 *
 * @param tenantId - Extraído do JWT (`tenantIdFromRequest`)
 * @returns Membros da equipa ordenados por data de criação e e-mail
 */
export class ListUsersByTenantUseCase {
  constructor(private readonly orgUserRepository: OrgUserRepository) {}

  async execute(tenantId: string): Promise<OrgUser[]> {
    return this.orgUserRepository.listByTenant(tenantId);
  }
}
