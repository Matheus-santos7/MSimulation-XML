import type { CteQueryPort } from "../../domain/ports/cte-query.port.js";

export class ListCtesUseCase {
  constructor(private readonly cteQuery: CteQueryPort) {}

  execute(tenantId: string) {
    return this.cteQuery.list(tenantId);
  }
}
