import type { NfeQueryPort } from "../../domain/ports/nfe-query.port.js";

export class ListNfesUseCase {
  constructor(private readonly nfeQuery: NfeQueryPort) {}

  execute(tenantId: string) {
    return this.nfeQuery.list(tenantId);
  }
}
