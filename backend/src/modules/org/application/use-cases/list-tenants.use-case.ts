import type { Tenant } from "../../domain/entities/tenant.entity.js";
import type { TenantRepository } from "../../domain/ports/tenant.repository.js";

export class ListTenantsUseCase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(): Promise<Tenant[]> {
    return this.tenantRepository.list();
  }
}
