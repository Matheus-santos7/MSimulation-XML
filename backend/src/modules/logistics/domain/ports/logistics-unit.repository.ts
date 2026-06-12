import type { LogisticsUnitImportRow } from "../entities/logistics-unit-import-row.entity.js";
import type { LogisticsUnit } from "../entities/logistics-unit.entity.js";

export type ListLogisticsUnitsFilter = {
  ativa?: boolean;
  q?: string;
  cnpj?: string;
};

export type BulkImportLogisticsUnitsResult = {
  totalPlanilha: number;
  unicos: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { line: number; message: string }[];
};

export type ShipmentDestinationResolution = {
  unitId: string;
  codigo: string;
  uf: string;
  nome: string;
  idCadIntTran?: string;
  destinatarioFiscal: LogisticsUnit["destinatarioFiscal"];
};

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
  resolveShipmentDestination(
    tenantId: string,
    destinationUnitId?: string,
  ): Promise<ShipmentDestinationResolution>;
  setDefaultUnit(tenantId: string, unitId: string): Promise<LogisticsUnit>;
  bulkImport(
    tenantId: string,
    rows: LogisticsUnitImportRow[],
    enrichCep: boolean,
  ): Promise<BulkImportLogisticsUnitsResult>;
}
