import { Inject, Injectable } from "@nestjs/common";
import { OrgError } from "../../errors/org.errors.js";
import { TenantRepository } from "../../tenant/tenant.repository.js";
import type { Tenant, TenantFiscalRoles } from "../../tenant/tenant.types.js";
import { FilialRepository } from "../filial.repository.js";

/**
 * Define quem emite remessas e quem emite transferências (matriz ou uma filial da empresa).
 *
 * @throws {OrgError.FilialInvalid} Estabelecimento informado não pertence à empresa
 */
@Injectable()
export class SetFiscalRolesUseCase {
  constructor(
    @Inject(TenantRepository) private readonly tenantRepository: TenantRepository,
    @Inject(FilialRepository) private readonly filialRepository: FilialRepository,
  ) {}

  async execute(tenantId: string, roles: TenantFiscalRoles): Promise<Tenant | null> {
    await this.assertEmitenteBelongsToTenant(tenantId, roles.emitenteRemessaId);
    await this.assertEmitenteBelongsToTenant(tenantId, roles.emitenteTransferenciaId);

    const tenant = await this.tenantRepository.updateFiscalRoles(tenantId, roles);

    return this.tenantRepository.findByIdWithFiliais(tenant.id);
  }

  private async assertEmitenteBelongsToTenant(
    tenantId: string,
    emitenteId: string | null | undefined,
  ): Promise<void> {
    if (emitenteId == null || emitenteId === "" || emitenteId === tenantId) return;

    const filial = await this.filialRepository.findById(tenantId, emitenteId);
    if (!filial) {
      throw new OrgError.FilialInvalid("Estabelecimento emitente não pertence a esta empresa");
    }
  }
}
