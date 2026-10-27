import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { UpdateTenantRequestDTO } from "./dtos/update-tenant.request.dto.js";
import { TenantRepository } from "./tenant.repository.js";
import type { Tenant } from "./tenant.types.js";

const TENANT_NOT_FOUND = "Empresa não encontrada";

/**
 * Empresa do usuário autenticado. Só o próprio tenant do JWT é visível: outro `id` responde 404,
 * como se a empresa não existisse.
 */
@Injectable()
export class TenantService {
  constructor(@Inject(TenantRepository) private readonly tenantRepository: TenantRepository) {}

  /** O tenant do JWT com as filiais, em lista (a UI espera um array). */
  async listOwn(tenantId: string): Promise<Tenant[]> {
    const tenant = await this.tenantRepository.findByIdWithFiliais(tenantId);

    return tenant ? [tenant] : [];
  }

  async getOwn(id: string, tenantId: string): Promise<Tenant> {
    this.assertOwnTenant(id, tenantId);

    return this.orNotFound(await this.tenantRepository.findByIdWithFiliais(id));
  }

  /** @throws {OrgError.TenantConflict} CNPJ alterado para um já cadastrado */
  async update(id: string, data: UpdateTenantRequestDTO): Promise<Tenant | null> {
    this.orNotFound(await this.tenantRepository.update(id, data));

    return this.tenantRepository.findByIdWithFiliais(id);
  }

  /** Outro `:id` que não o tenant do JWT responde 404. */
  assertOwnTenant(id: string, tenantId: string): void {
    if (id !== tenantId) throw new NotFoundException(TENANT_NOT_FOUND);
  }

  private orNotFound<T>(value: T | null): T {
    if (value == null) throw new NotFoundException(TENANT_NOT_FOUND);

    return value;
  }
}
