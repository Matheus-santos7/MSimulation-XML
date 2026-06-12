import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

/**
 * Obtém detalhe de uma unidade logística pelo ID.
 *
 * @param tenantId - Contexto do tenant (vínculo `padrao`)
 * @param id - UUID da unidade ML
 * @returns Unidade ou `null` se não existir
 */
export class GetLogisticsUnitByIdUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(tenantId: string, id: string) {
    return this.logisticsUnitRepository.findByIdForTenant(tenantId, id);
  }
}
