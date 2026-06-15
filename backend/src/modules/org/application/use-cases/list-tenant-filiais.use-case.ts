import type { TenantFilial } from "../../domain/entities/tenant-filial.entity.js";
import type { TenantFilialRepository } from "../../domain/ports/tenant-filial.repository.js";

export class ListTenantFiliaisUseCase {
  constructor(private readonly tenantFilialRepository: TenantFilialRepository) {}

  execute(tenantId: string): Promise<TenantFilial[]> {
    return this.tenantFilialRepository.listByTenant(tenantId);
  }
}
