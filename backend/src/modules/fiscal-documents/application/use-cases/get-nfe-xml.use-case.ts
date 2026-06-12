import type { NfeQueryPort } from "../../domain/ports/nfe-query.port.js";

export class GetNfeXmlUseCase {
  constructor(private readonly nfeQuery: NfeQueryPort) {}

  execute(tenantId: string, accessKey: string) {
    return this.nfeQuery.resolveXml(tenantId, accessKey);
  }

  getTipoWhenMissing(tenantId: string, accessKey: string) {
    return this.nfeQuery.getTipoWhenXmlMissing(tenantId, accessKey);
  }
}
