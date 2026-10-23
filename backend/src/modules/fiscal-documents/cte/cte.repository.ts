import { Injectable } from "@nestjs/common";
import { mapCte } from "../shared/fiscal-document.mapper.js";
import { fiscalNotDeleted } from "../shared/fiscal-not-deleted.js";
import { resolveCteXml } from "./xml/cte-xml.service.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";

@Injectable()
export class CteRepository {
  private get db() {
    return getDbClient();
  }

  async list(tenantId: string) {
    const rows = await this.db.cTe.findMany({
      where: { tenantId, ...fiscalNotDeleted },
      include: {
        nfeRemessa: { select: { chave: true, numero: true, serie: true } },
        nfeVenda: { select: { chave: true, numero: true, serie: true } },
      },
      orderBy: { emitidoEm: "desc" },
    });
    return rows.map((row) => mapCte(row) as Record<string, unknown>);
  }

  async getByAccessKey(tenantId: string, accessKey: string) {
    const row = await this.db.cTe.findFirst({
      where: { chave: accessKey, tenantId, ...fiscalNotDeleted },
      include: {
        nfeRemessa: { select: { chave: true, numero: true, serie: true } },
        nfeVenda: { select: { chave: true, numero: true, serie: true } },
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

  /** Exclusão lógica; `false` quando o CT-e não existe ou já foi excluído. */
  async softDelete(accessKey: string, tenantId: string): Promise<boolean> {
    const existing = await this.db.cTe.findFirst({ where: { chave: accessKey, tenantId } });
    if (!existing || existing.deletedAt) return false;

    await this.db.cTe.update({
      where: { chave: accessKey },
      data: { deletedAt: new Date() },
    });

    return true;
  }
}
