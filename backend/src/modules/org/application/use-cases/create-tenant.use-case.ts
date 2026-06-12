import type { Tenant } from "../../domain/entities/tenant.entity.js";
import type { TenantRepository } from "../../domain/ports/tenant.repository.js";
import type { CreateTenantCommand } from "../dto/create-tenant.command.js";

/**
 * Cria um tenant (empresa emitente) com dados fiscais completos.
 *
 * Usado internamente pelo onboarding (`auth`) e exportado pelo módulo org.
 * Não exposto diretamente na API protegida (`POST /tenants` retorna 403).
 *
 * @param command - Dados cadastrais e endereço do emitente
 * @returns Tenant criado
 * @throws {TenantConflictError} CNPJ já cadastrado
 */
export class CreateTenantUseCase {
  constructor(private readonly tenantRepository: TenantRepository) {}

  async execute(command: CreateTenantCommand): Promise<Tenant> {
    return this.tenantRepository.create(command);
  }
}
