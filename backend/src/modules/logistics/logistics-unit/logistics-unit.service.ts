import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";
import { LogisticsUnitRepository } from "./logistics-unit.repository.js";
import type { LogisticsUnit } from "./logistics-unit.types.js";
import type { LogisticsUnitImportRow } from "./types/logistics-unit-import-row.types.js";
import type {
  BulkImportLogisticsUnitsResult,
  ListLogisticsUnitsFilter,
  ShipmentDestinationResolution,
} from "./types/logistics-unit-query.types.js";

/**
 * CDs de fulfillment vinculados à empresa: listagem, importação, CD padrão e resolução do
 * destino da remessa (usado pelo remessas).
 */
@Injectable()
export class LogisticsUnitService {
  constructor(
    @Inject(LogisticsUnitRepository) private readonly repository: LogisticsUnitRepository,
  ) {}

  list(tenantId: string, filter: ListLogisticsUnitsFilter = {}): Promise<LogisticsUnit[]> {
    return this.repository.listByTenant(tenantId, filter);
  }

  async get(tenantId: string, id: string): Promise<LogisticsUnit> {
    const unit = await this.repository.findByIdForTenant(tenantId, id);
    if (!unit) throw new NotFoundException("Unidade não encontrada");

    return unit;
  }

  /** Importa CDs de um marketplace (código e CNPJ únicos dentro dele). */
  bulkImport(
    tenantId: string,
    marketplace: MarketplaceCode,
    rows: LogisticsUnitImportRow[],
    enrichCep: boolean,
  ): Promise<BulkImportLogisticsUnitsResult> {
    return this.repository.bulkImport(tenantId, marketplace, rows, enrichCep);
  }

  /** @throws {LogisticsUnitError} Unidade inexistente ou inativa */
  setDefault(tenantId: string, unitId: string): Promise<LogisticsUnit> {
    return this.repository.setDefaultUnit(tenantId, unitId);
  }

  /**
   * CD de destino da remessa: o informado ou o padrão da empresa.
   * @throws {LogisticsUnitError} CD inativo ou sem padrão configurado
   */
  resolveShipmentDestination(
    tenantId: string,
    destinationUnitId?: string,
  ): Promise<ShipmentDestinationResolution> {
    return this.repository.resolveShipmentDestination(tenantId, destinationUnitId);
  }

  getActive(unitId: string) {
    return this.repository.findActiveById(unitId);
  }

  getActiveByCode(code: string) {
    return this.repository.findActiveByCode(code);
  }
}
