import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

export class SetDefaultLogisticsUnitUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(tenantId: string, unitId: string) {
    return this.logisticsUnitRepository.setDefaultUnit(tenantId, unitId);
  }
}
