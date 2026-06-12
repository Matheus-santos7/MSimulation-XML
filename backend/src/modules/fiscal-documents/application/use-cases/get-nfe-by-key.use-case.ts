import type { NfeQueryPort } from "../../domain/ports/nfe-query.port.js";

export class GetNfeByKeyUseCase {
  constructor(private readonly nfeQuery: NfeQueryPort) {}

  execute(tenantId: string, accessKey: string) {
    return this.nfeQuery.getByAccessKey(tenantId, accessKey);
  }
}
