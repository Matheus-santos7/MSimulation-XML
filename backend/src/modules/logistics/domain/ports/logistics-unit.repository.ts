import type { LogisticsUnitImportRow } from "../entities/logistics-unit-import-row.entity.js";
import type { LogisticsUnit } from "../entities/logistics-unit.entity.js";

/** Filtros da listagem de unidades logísticas. */
export type ListLogisticsUnitsFilter = {
  ativa?: boolean;
  q?: string;
  cnpj?: string;
};

/** Resultado agregado da importação em massa de CDs ML. */
export type BulkImportLogisticsUnitsResult = {
  totalPlanilha: number;
  unicos: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; message: string }[];
};

/**
 * Destino fiscal resolvido para emissão de remessa (CD explícito ou padrão do tenant).
 */
export type ShipmentDestinationResolution = {
  unitId: string;
  codigo: string;
  uf: string;
  nome: string;
  idCadIntTran?: string;
  destinatarioFiscal: LogisticsUnit["destinatarioFiscal"];
};

/**
 * Port de persistência e resolução de unidades logísticas Meli Full.
 */
export interface LogisticsUnitRepository {
  listByTenant(tenantId: string, filter?: ListLogisticsUnitsFilter): Promise<LogisticsUnit[]>;
  findByIdForTenant(tenantId: string, id: string): Promise<LogisticsUnit | null>;
  findActiveById(unitId: string): Promise<{
    id: string;
    codigo: string;
    uf: string;
    nome: string;
    ativa: boolean;
  } | null>;
  findActiveByCode(code: string): Promise<{
    id: string;
    codigo: string;
    uf: string;
    nome: string;
    ativa: boolean;
  } | null>;
  /**
   * Resolve CD de destino: ID explícito ou unidade `padrao` do tenant.
   * @throws {LogisticsUnitError} CD inativo ou sem padrão configurado
   */
  resolveShipmentDestination(
    tenantId: string,
    destinationUnitId?: string,
  ): Promise<ShipmentDestinationResolution>;
  /**
   * Define unidade padrão do tenant (desmarca as demais).
   * @throws {LogisticsUnitError} Unidade inexistente ou inativa
   */
  setDefaultUnit(tenantId: string, unitId: string): Promise<LogisticsUnit>;
  bulkImport(
    tenantId: string,
    rows: LogisticsUnitImportRow[],
    enrichCep: boolean,
  ): Promise<BulkImportLogisticsUnitsResult>;
}
