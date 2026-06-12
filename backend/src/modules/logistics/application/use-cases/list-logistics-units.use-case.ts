import type {
  ListLogisticsUnitsFilter,
  LogisticsUnitRepository,
} from "../../domain/ports/logistics-unit.repository.js";

export class ListLogisticsUnitsUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(tenantId: string, filter?: ListLogisticsUnitsFilter) {
    return this.logisticsUnitRepository.listByTenant(tenantId, filter);
  }
}
