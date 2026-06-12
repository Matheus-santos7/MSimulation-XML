import type {
  ListLogisticsUnitsFilter,
  LogisticsUnitRepository,
} from "../../domain/ports/logistics-unit.repository.js";

/**
 * Lista unidades logísticas Meli visíveis ao tenant com filtros opcionais.
 *
 * @param tenantId - Tenant emitente
 * @param filter - `ativa`, busca textual (`q`) ou CNPJ parcial
 * @returns CDs com flag `padrao` do vínculo tenant ↔ unidade
 */
export class ListLogisticsUnitsUseCase {
  constructor(private readonly logisticsUnitRepository: LogisticsUnitRepository) {}

  execute(tenantId: string, filter?: ListLogisticsUnitsFilter) {
    return this.logisticsUnitRepository.listByTenant(tenantId, filter);
  }
}
