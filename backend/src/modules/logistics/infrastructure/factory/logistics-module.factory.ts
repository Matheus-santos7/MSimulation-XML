import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { BulkImportLogisticsUnitsUseCase } from "../../application/use-cases/bulk-import-logistics-units.use-case.js";
import { GetActiveLogisticsUnitByCodeUseCase } from "../../application/use-cases/get-active-logistics-unit-by-code.use-case.js";
import { GetActiveLogisticsUnitUseCase } from "../../application/use-cases/get-active-logistics-unit.use-case.js";
import { GetLogisticsUnitByIdUseCase } from "../../application/use-cases/get-logistics-unit-by-id.use-case.js";
import { HasAdvanceStockUseCase } from "../../application/use-cases/has-advance-stock.use-case.js";
import { ListLogisticsUnitsUseCase } from "../../application/use-cases/list-logistics-units.use-case.js";
import { ListProductMovementsUseCase } from "../../application/use-cases/list-product-movements.use-case.js";
import { RegisterProductMovementUseCase } from "../../application/use-cases/register-product-movement.use-case.js";
import { ResolveAdvanceProductUseCase } from "../../application/use-cases/resolve-advance-product.use-case.js";
import { ResolveShipmentDestinationUseCase } from "../../application/use-cases/resolve-shipment-destination.use-case.js";
import { SetDefaultLogisticsUnitUseCase } from "../../application/use-cases/set-default-logistics-unit.use-case.js";
import { AdvanceProductResolverAdapter } from "../external/advance-product-resolver.adapter.js";
import { CepLookupAdapter } from "../external/cep-lookup.adapter.js";
import { PrismaLogisticsUnitRepository } from "../prisma/prisma-logistics-unit.repository.js";
import { PrismaProductMovementRepository } from "../prisma/prisma-product-movement.repository.js";

/** Composition root for the Logistics module. */
export function createLogisticsModule(db: DbClient) {
  const cepLookup = new CepLookupAdapter();
  const logisticsUnitRepository = new PrismaLogisticsUnitRepository(db, cepLookup);
  const productMovementRepository = new PrismaProductMovementRepository(db);
  const advanceProductResolver = new AdvanceProductResolverAdapter(db);

  return {
    listLogisticsUnits: new ListLogisticsUnitsUseCase(logisticsUnitRepository),
    getLogisticsUnitById: new GetLogisticsUnitByIdUseCase(logisticsUnitRepository),
    bulkImportLogisticsUnits: new BulkImportLogisticsUnitsUseCase(logisticsUnitRepository),
    setDefaultLogisticsUnit: new SetDefaultLogisticsUnitUseCase(logisticsUnitRepository),
    resolveShipmentDestination: new ResolveShipmentDestinationUseCase(logisticsUnitRepository),
    getActiveLogisticsUnit: new GetActiveLogisticsUnitUseCase(logisticsUnitRepository),
    getActiveLogisticsUnitByCode: new GetActiveLogisticsUnitByCodeUseCase(logisticsUnitRepository),
    listProductMovements: new ListProductMovementsUseCase(productMovementRepository),
    registerProductMovement: new RegisterProductMovementUseCase(productMovementRepository),
    resolveAdvanceProduct: new ResolveAdvanceProductUseCase(advanceProductResolver),
    hasAdvanceStock: new HasAdvanceStockUseCase(advanceProductResolver),
    logisticsUnitRepository,
    productMovementRepository,
    advanceProductResolver,
  };
}
