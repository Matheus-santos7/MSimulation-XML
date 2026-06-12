import type { LogisticsUnitImportRow } from "../../domain/entities/logistics-unit-import-row.entity.js";
import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

export class BulkImportLogisticsUnitsUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(tenantId: string, rows: LogisticsUnitImportRow[], enrichCep = true) {
    return this.logisticsUnitRepository.bulkImport(tenantId, rows, enrichCep);
  }
}
