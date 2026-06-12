import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { mapCte } from "../../presentation/mappers/fiscal-mappers.js";
import { fiscalNotDeleted } from "../../domain/constants/fiscal-not-deleted.js";
import { resolveCteXml } from "../xml/cte-xml-service.js";
import type { CteQueryPort } from "../../domain/ports/cte-query.port.js";

export class PrismaCteQueryRepository implements CteQueryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string) {
    const rows = await this.prisma.cTe.findMany({
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
    const row = await this.prisma.cTe.findFirst({
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
    return resolveCteXml(this.prisma, tenantId, accessKey);
  }

  async exists(tenantId: string, accessKey: string) {
    const row = await this.prisma.cTe.findFirst({
      where: { chave: accessKey, tenantId, ...fiscalNotDeleted },
      select: { id: true },
    });
    return row !== null;
  }
}
