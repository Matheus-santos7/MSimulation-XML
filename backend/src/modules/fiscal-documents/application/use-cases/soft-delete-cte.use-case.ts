import type { FiscalDocumentSoftDeletePort } from "../../domain/ports/fiscal-document-soft-delete.port.js";

export class SoftDeleteCteUseCase {
  constructor(private readonly softDelete: FiscalDocumentSoftDeletePort) {}

  execute(accessKey: string, tenantId: string) {
    return this.softDelete.softDeleteCte(accessKey, tenantId);
  }
}
