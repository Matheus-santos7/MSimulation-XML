import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

export class GetActiveLogisticsUnitUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(unitId: string) {
    return this.logisticsUnitRepository.findActiveById(unitId);
  }
}
