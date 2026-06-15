import type { TenantFilialRepository } from "../../domain/ports/tenant-filial.repository.js";
import type { Tenant } from "../../domain/entities/tenant.entity.js";
import { TenantFilialError } from "../../domain/errors/tenant-filial.error.js";
import type { TenantFiscalRoles, TenantRepository } from "../../domain/ports/tenant.repository.js";

export class SetTenantFiscalRolesUseCase {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly tenantFilialRepository: TenantFilialRepository,
  ) {}

  async execute(tenantId: string, roles: TenantFiscalRoles): Promise<Tenant> {
    await this.assertEmitenteBelongsToTenant(tenantId, roles.emitenteRemessaId);
    await this.assertEmitenteBelongsToTenant(tenantId, roles.emitenteTransferenciaId);
    return this.tenantRepository.updateFiscalRoles(tenantId, roles);
  }

  private async assertEmitenteBelongsToTenant(
    tenantId: string,
    emitenteId: string | null | undefined,
  ): Promise<void> {
    if (emitenteId == null || emitenteId === "" || emitenteId === tenantId) return;
    const filial = await this.tenantFilialRepository.findById(tenantId, emitenteId);
    if (!filial) {
      throw new TenantFilialError("Estabelecimento emitente não pertence a esta empresa");
    }
  }
}
