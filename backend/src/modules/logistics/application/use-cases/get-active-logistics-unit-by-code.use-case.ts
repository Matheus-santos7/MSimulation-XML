import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

export class GetActiveLogisticsUnitByCodeUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(code: string) {
    return this.logisticsUnitRepository.findActiveByCode(code);
  }
}
