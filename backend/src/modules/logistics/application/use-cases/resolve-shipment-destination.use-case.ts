import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

export class ResolveShipmentDestinationUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(tenantId: string, destinationUnitId?: string) {
    return this.logisticsUnitRepository.resolveShipmentDestination(tenantId, destinationUnitId);
  }
}
