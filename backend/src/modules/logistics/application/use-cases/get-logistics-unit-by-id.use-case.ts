import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

export class GetLogisticsUnitByIdUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(tenantId: string, id: string) {
    return this.logisticsUnitRepository.findByIdForTenant(tenantId, id);
  }
}
