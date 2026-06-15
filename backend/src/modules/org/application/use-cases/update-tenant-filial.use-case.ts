import type { TenantFilial } from "../../domain/entities/tenant-filial.entity.js";
import type { TenantFilialRepository, TenantFilialWriteData } from "../../domain/ports/tenant-filial.repository.js";

export class UpdateTenantFilialUseCase {
  constructor(private readonly tenantFilialRepository: TenantFilialRepository) {}

  execute(
    tenantId: string,
    id: string,
    data: Partial<TenantFilialWriteData>,
  ): Promise<TenantFilial | null> {
    return this.tenantFilialRepository.update(tenantId, id, data);
  }
}
