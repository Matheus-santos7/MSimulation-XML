import type { OrgUser } from "../../domain/entities/org-user.entity.js";
import type { OrgUserRepository } from "../../domain/ports/org-user.repository.js";

/**
 * Obtém detalhe de um utilizador com isolamento por tenant.
 *
 * @param id - UUID do utilizador
 * @param tenantId - Tenant do JWT; impede leitura cross-tenant
 * @returns OrgUser ou `null` se não pertencer a este tenant
 */
export class GetUserByIdUseCase {
  constructor(private readonly orgUserRepository: OrgUserRepository) {}

  async execute(id: string, tenantId: string): Promise<OrgUser | null> {
    return this.orgUserRepository.findById(id, tenantId);
  }
}
