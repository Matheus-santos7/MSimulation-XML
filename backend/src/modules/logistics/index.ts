/**
 * API pública da logística para outros módulos. Não reexporta o `LogisticsModule` (o
 * `app.module.ts` importa pelo caminho dele).
 */
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
