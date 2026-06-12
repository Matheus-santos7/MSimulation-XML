import type { Tenant } from "../../domain/entities/tenant.entity.js";
import type { TenantRepository } from "../../domain/ports/tenant.repository.js";

/**
 * Obtém dados cadastrais de um tenant pelo ID.
 *
 * O controller garante que `id === tenantId` do JWT antes de chamar este caso de uso.
 *
 * @param id - UUID do tenant
 * @returns Tenant ou `null` se não existir
 */
export class GetTenantByIdUseCase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findById(id);
  }
}
