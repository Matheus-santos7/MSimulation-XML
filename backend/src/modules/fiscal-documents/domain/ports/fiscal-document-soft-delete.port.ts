export interface FiscalDocumentSoftDeletePort {
  softDeleteNfe(accessKey: string, tenantId: string): Promise<boolean>;
  softDeleteCte(accessKey: string, tenantId: string): Promise<boolean>;
}
