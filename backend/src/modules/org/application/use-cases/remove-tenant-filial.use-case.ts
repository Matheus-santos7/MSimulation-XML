import type { TenantFilialRepository } from "../../domain/ports/tenant-filial.repository.js";

export class RemoveTenantFilialUseCase {
  constructor(private readonly tenantFilialRepository: TenantFilialRepository) {}

  execute(tenantId: string, id: string): Promise<boolean> {
    return this.tenantFilialRepository.delete(tenantId, id);
  }
}
