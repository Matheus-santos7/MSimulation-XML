import type { InutilizeNumberInput } from "./domain/ports/fiscal-document-lifecycle.port.js";
import { createFiscalDocumentsModule } from "./infrastructure/factory/fiscal-documents-module.factory.js";

export { DocumentCancellationError } from "./domain/errors/document-cancellation.error.js";
export { DocumentReturnError } from "./domain/errors/document-return.error.js";
export { NumberInutilizationError } from "./domain/errors/number-inutilization.error.js";

export type {
  CancelDocumentResult,
  ProcessReturnResult,
  InutilizationResult,
  ReversedShipmentBalance,
} from "./domain/entities/lifecycle-result.entity.js";

export type { CancelDocumentInput, ProcessReturnInput, InutilizeNumberInput } from "./domain/ports/fiscal-document-lifecycle.port.js";

export { CancelDocumentUseCase } from "./application/use-cases/cancel-document.use-case.js";
export { ProcessReturnUseCase } from "./application/use-cases/process-return.use-case.js";
export { InutilizeNumberUseCase } from "./application/use-cases/inutilize-number.use-case.js";

export { fiscalNotDeleted } from "./domain/constants/fiscal-not-deleted.js";
export {
  resolveNfeXml,
  resolveNfeCancelamentoEventoXml,
  persistNfeXmlAutorizado,
  persistNfeXmlFromEmission,
  buildNfeXmlAutorizado,
} from "./infrastructure/xml/nfe-xml-service.js";
export {
  resolveCteXml,
  persistCteXmlAutorizado,
  persistCteFromEmission,
  buildCteXmlAutorizado,
} from "./infrastructure/xml/cte-xml-service.js";
export { listTimelineChains } from "./infrastructure/observability/timeline-service.js";

export { createFiscalDocumentsModule };
export { nfeController } from "./presentation/controllers/nfe.controller.js";
export { nfeLifecycleController } from "./presentation/controllers/nfe-lifecycle.controller.js";
export { cteController } from "./presentation/controllers/cte.controller.js";
export { fiscalObservabilityController } from "./presentation/controllers/fiscal-observability.controller.js";
export {
  nfeAccessKeyParamSchema,
  cancelDocumentBodySchema,
  inutilizeNumberBodySchema,
} from "./presentation/schemas/fiscal-document.schemas.js";

export async function cancelSaleNfe(
  saleNfeKey: string,
  tenantId: string,
  justification?: string,
) {
  return createFiscalDocumentsModule().cancelDocument.execute({
    tenantId,
    nfeKey: saleNfeKey,
    justification,
  });
}

export async function processSaleReturn(
  saleNfeKey: string,
  tenantId: string,
) {
  return createFiscalDocumentsModule().processReturn.execute({
    tenantId,
    saleNfeKey,
  });
}

export async function inutilizeNfeNumberRange(
  input: InutilizeNumberInput,
) {
  return createFiscalDocumentsModule().inutilizeNumber.execute(input);
}
