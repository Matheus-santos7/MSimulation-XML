import type { FiscalDocumentSoftDeletePort } from "../../domain/ports/fiscal-document-soft-delete.port.js";

export class SoftDeleteNfeUseCase {
  constructor(private readonly softDelete: FiscalDocumentSoftDeletePort) {}

  execute(accessKey: string, tenantId: string) {
    return this.softDelete.softDeleteNfe(accessKey, tenantId);
  }
}
