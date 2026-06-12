import type { CteQueryPort } from "../../domain/ports/cte-query.port.js";

export class GetCteByKeyUseCase {
  constructor(private readonly cteQuery: CteQueryPort) {}

  execute(tenantId: string, accessKey: string) {
    return this.cteQuery.getByAccessKey(tenantId, accessKey);
  }
}
