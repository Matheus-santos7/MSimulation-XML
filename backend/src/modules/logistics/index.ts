/**
 * API pública da logística para outros módulos. Não reexporta o `LogisticsModule` (o
 * `app.module.ts` importa pelo caminho dele).
 */
import { CepLookupProvider } from "../lookup/index.js";
import { LogisticsUnitRepository } from "./logistics-unit/logistics-unit.repository.js";
import { LogisticsUnitService } from "./logistics-unit/logistics-unit.service.js";
import { AdvanceProductResolver } from "./product-movement/advance-product.resolver.js";
import { ProductMovementRepository } from "./product-movement/product-movement.repository.js";
import { ProductMovementService } from "./product-movement/product-movement.service.js";
import type { RegisterProductMovementData } from "./product-movement/types/product-movement-query.types.js";

export { LogisticsUnitError } from "./errors/logistics.errors.js";
export {
  findActiveLogisticsUnitRecord,
  findActiveLogisticsUnitRecordByCode,
} from "./logistics-unit/active-logistics-unit.queries.js";
export { mapLogisticsUnitFromPrisma } from "./logistics-unit/logistics-unit.mapper.js";
export { LogisticsUnitService } from "./logistics-unit/logistics-unit.service.js";
export type {
  LogisticsUnit,
  LogisticsUnitFiscalDestination,
} from "./logistics-unit/logistics-unit.types.js";
export {
  unidadeParaDestinoFiscal,
  type UnidadeDestinoFiscal,
} from "./logistics-unit/rules/destino-fiscal.js";
export type { LogisticsUnitImportRow } from "./logistics-unit/types/logistics-unit-import-row.types.js";
export { findProductInTenant } from "./product-movement/product-lookup.queries.js";
export { mapProductMovementFromPrisma } from "./product-movement/product-movement.mapper.js";
export { ProductMovementService } from "./product-movement/product-movement.service.js";
export type { ProductMovement } from "./product-movement/product-movement.types.js";
export type { AdvanceProductResolved } from "./product-movement/types/advance-product.types.js";
export type { RegisterProductMovementData } from "./product-movement/types/product-movement-query.types.js";

/**
 * @deprecated Serviços do logistics fora do container Nest, no formato `{ execute }` que o
 * remessas usa. Sai na conversão do remessas, que passa a receber os services por injeção.
 */
export function createLogisticsModule() {
  const units = new LogisticsUnitService(new LogisticsUnitRepository(new CepLookupProvider()));
  const movements = new ProductMovementService(
    new ProductMovementRepository(),
    new AdvanceProductResolver(),
  );

  return {
    getActiveLogisticsUnit: { execute: (unitId: string) => units.getActive(unitId) },
    getActiveLogisticsUnitByCode: { execute: (code: string) => units.getActiveByCode(code) },
    resolveShipmentDestination: {
      execute: (tenantId: string, destinationUnitId?: string) =>
        units.resolveShipmentDestination(tenantId, destinationUnitId),
    },
    registerProductMovement: {
      execute: (data: RegisterProductMovementData, db?: unknown) => movements.register(data, db),
    },
    resolveAdvanceProduct: {
      execute: (tenantId: string, productId: string, productSku?: string) =>
        movements.resolveAdvanceProduct(tenantId, productId, productSku),
    },
  };
}
