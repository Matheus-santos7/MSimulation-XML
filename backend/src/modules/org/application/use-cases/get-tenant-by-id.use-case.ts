import type { Tenant } from "../../domain/entities/tenant.entity.js";
import type { TenantRepository } from "../../domain/ports/tenant.repository.js";

export class GetTenantByIdUseCase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findById(id);
  }
}
