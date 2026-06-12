import type { Tenant } from "../../domain/entities/tenant.entity.js";
import type { TenantRepository } from "../../domain/ports/tenant.repository.js";
import type { UpdateTenantCommand } from "../dto/update-tenant.command.js";

export class UpdateTenantUseCase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(id: string, command: UpdateTenantCommand): Promise<Tenant | null> {
    return this.tenantRepository.update(id, command);
  }
}
