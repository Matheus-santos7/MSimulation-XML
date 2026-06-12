import type { Tenant } from "../../domain/entities/tenant.entity.js";
import type { TenantRepository } from "../../domain/ports/tenant.repository.js";
import type { CreateTenantCommand } from "../dto/create-tenant.command.js";

export class CreateTenantUseCase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(command: CreateTenantCommand): Promise<Tenant> {
    return this.tenantRepository.create(command);
  }
}
