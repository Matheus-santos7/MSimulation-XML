import type { TenantFilial } from "../../domain/entities/tenant-filial.entity.js";
import type { TenantFilialRepository, TenantFilialWriteData } from "../../domain/ports/tenant-filial.repository.js";

export class AddTenantFilialUseCase {
  constructor(private readonly tenantFilialRepository: TenantFilialRepository) {}

  execute(tenantId: string, data: TenantFilialWriteData): Promise<TenantFilial> {
    return this.tenantFilialRepository.create(tenantId, data);
  }
}
