import type { Tenant } from "../../domain/entities/tenant.entity.js";
import type { TenantRepository } from "../../domain/ports/tenant.repository.js";
import type { UpdateTenantCommand } from "../dto/update-tenant.command.js";

/**
 * Atualiza dados cadastrais do tenant (PATCH parcial).
 *
 * @param id - UUID do tenant (validado no controller contra JWT)
 * @param command - Campos a alterar (razão social, endereço, ambiente, etc.)
 * @returns Tenant atualizado ou `null` se não existir
 * @throws {TenantConflictError} CNPJ duplicado se alterado
 */
export class UpdateTenantUseCase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(id: string, command: UpdateTenantCommand): Promise<Tenant | null> {
    return this.tenantRepository.update(id, command);
  }
}
