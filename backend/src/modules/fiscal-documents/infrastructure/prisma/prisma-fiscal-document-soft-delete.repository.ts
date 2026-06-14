import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import type { FiscalDocumentSoftDeletePort } from "../../domain/ports/fiscal-document-soft-delete.port.js";

export class PrismaFiscalDocumentSoftDeleteRepository implements FiscalDocumentSoftDeletePort {
  constructor(private readonly prisma: DbClient) {}

  async softDeleteNfe(accessKey: string, tenantId: string): Promise<boolean> {
    const existing = await this.prisma.nFe.findFirst({ where: { chave: accessKey, tenantId } });
    if (!existing || existing.deletedAt) return false;
    await this.prisma.nFe.update({
      where: { chave: accessKey },
      data: { deletedAt: new Date() },
    });
    return true;
  }

  async softDeleteCte(accessKey: string, tenantId: string): Promise<boolean> {
    const existing = await this.prisma.cTe.findFirst({ where: { chave: accessKey, tenantId } });
    if (!existing || existing.deletedAt) return false;
    await this.prisma.cTe.update({
      where: { chave: accessKey },
      data: { deletedAt: new Date() },
    });
    return true;
  }
}
