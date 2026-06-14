import { mapCte } from "../../presentation/mappers/fiscal-mappers.js";
import { fiscalNotDeleted } from "../../domain/constants/fiscal-not-deleted.js";
import { resolveCteXml } from "../xml/cte-xml-service.js";
import type { CteQueryPort } from "../../domain/ports/cte-query.port.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";

export class PrismaCteQueryRepository implements CteQueryPort {
  private get db() {
    return getDbClient();
  }

  async list(tenantId: string) {
    const rows = await this.db.cTe.findMany({
      where: { tenantId, ...fiscalNotDeleted },
      include: {
        nfeRemessa: { select: { chave: true } },
        nfeVenda: { select: { chave: true } },
      },
      orderBy: { emitidoEm: "desc" },
    });
    return rows.map((row) => mapCte(row) as Record<string, unknown>);
  }

  async getByAccessKey(tenantId: string, accessKey: string) {
    const row = await this.db.cTe.findFirst({
      where: { chave: accessKey, tenantId, ...fiscalNotDeleted },
      include: {
        nfeRemessa: { select: { chave: true } },
        nfeVenda: { select: { chave: true } },
      },
    });
    if (!row) return null;
    return mapCte(row) as Record<string, unknown>;
  }

  async resolveXml(tenantId: string, accessKey: string) {
    return resolveCteXml(this.db, tenantId, accessKey);
  }

  async exists(tenantId: string, accessKey: string) {
    const row = await this.db.cTe.findFirst({
      where: { chave: accessKey, tenantId, ...fiscalNotDeleted },
      select: { id: true },
    });
    return row !== null;
  }
}
