import type { TenantRepository } from "../../domain/ports/tenant.repository.js";

export class DeleteTenantUseCase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(id: string): Promise<boolean> {
    return this.tenantRepository.delete(id);
  }
}
