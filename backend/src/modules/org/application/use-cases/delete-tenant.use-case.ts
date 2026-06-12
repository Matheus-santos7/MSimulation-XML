import type { TenantRepository } from "../../domain/ports/tenant.repository.js";

/**
 * Remove um tenant da base de dados.
 *
 * Não exposto na API HTTP (`DELETE /tenants/:id` retorna 403).
 * Exclusão em cascata de utilizadores e dados vinculados é tratada pelo Prisma.
 *
 * @param id - UUID do tenant
 * @returns `true` se removido, `false` se não existir
 */
export class DeleteTenantUseCase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(id: string): Promise<boolean> {
    return this.tenantRepository.delete(id);
  }
}
