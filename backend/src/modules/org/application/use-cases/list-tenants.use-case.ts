import type { Tenant } from "../../domain/entities/tenant.entity.js";
import type { TenantRepository } from "../../domain/ports/tenant.repository.js";

/**
 * Lista todos os tenants na base de dados.
 *
 * Uso administrativo/interno; a API HTTP expõe apenas o tenant do JWT
 * via `GetTenantByIdUseCase` no controller.
 *
 * @returns Todos os tenants ordenados por data de criação
 */
export class ListTenantsUseCase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(): Promise<Tenant[]> {
    return this.tenantRepository.list();
  }
}
