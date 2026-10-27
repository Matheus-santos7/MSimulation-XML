import type { MarketplaceCode } from "@msimulation-xml/fiscal-core";
import type { LogisticsUnit } from "../logistics-unit.types.js";

/** Filtros da listagem de unidades logísticas. */
export type ListLogisticsUnitsFilter = {
  ativa?: boolean;
  marketplace?: MarketplaceCode;
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
  /** Marketplace dono do CD: define o perfil fiscal e a configuração do faturador da remessa. */
  marketplace: MarketplaceCode;
  codigo: string;
  uf: string;
  nome: string;
  idCadIntTran?: string;
  destinatarioFiscal: LogisticsUnit["destinatarioFiscal"];
};
