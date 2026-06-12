import type { LogisticsUnitImportRow } from "../../domain/entities/logistics-unit-import-row.entity.js";
import type { LogisticsUnitRepository } from "../../domain/ports/logistics-unit.repository.js";

/**
 * Importa unidades logísticas a partir de planilha ML (JSON ou XLSX).
 *
 * Deduplica por CNPJ, normaliza endereços e opcionalmente enriquece CEP via lookup.
 *
 * @param tenantId - Tenant que vincula os CDs importados
 * @param rows - Linhas parseadas da planilha
 * @param enrichCep - Se `true`, consulta bairro/IBGE por CEP (padrão)
 * @returns Contadores created/updated/skipped e erros por linha
 */
export class BulkImportLogisticsUnitsUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(tenantId: string, rows: LogisticsUnitImportRow[], enrichCep = true) {
    return this.logisticsUnitRepository.bulkImport(tenantId, rows, enrichCep);
  }
}
