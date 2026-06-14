import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { FiscalDocumentSoftDeletePort } from "../../domain/ports/fiscal-document-soft-delete.port.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";

export class PrismaFiscalDocumentSoftDeleteRepository implements FiscalDocumentSoftDeletePort {
  private get db() {
    return getDbClient();
  }

  async softDeleteNfe(accessKey: string, tenantId: string): Promise<boolean> {
    const existing = await this.db.nFe.findFirst({ where: { chave: accessKey, tenantId } });
    if (!existing || existing.deletedAt) return false;
    await this.db.nFe.update({
      where: { chave: accessKey },
      data: { deletedAt: new Date() },
    });
    return true;
  }

  async softDeleteCte(accessKey: string, tenantId: string): Promise<boolean> {
    const existing = await this.db.cTe.findFirst({ where: { chave: accessKey, tenantId } });
    if (!existing || existing.deletedAt) return false;
    await this.db.cTe.update({
      where: { chave: accessKey },
      data: { deletedAt: new Date() },
    });
    return true;
  }
}
