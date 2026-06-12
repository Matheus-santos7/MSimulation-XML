import { NFeTipo, type PrismaClient } from "../../../../generated/prisma/client.js";
import { mapNfe } from "../../../../lib/fiscal/fiscal-mappers.js";
import { fiscalNotDeleted } from "../../domain/constants/fiscal-not-deleted.js";
import { resolveNfeXml } from "../xml/nfe-xml-service.js";
import {
  atualizarItensSaldoFifoParaNfes,
  saldoLiquidoRemessaNfe,
} from "../../../remessas/infrastructure/fifo/remessa-fifo.js";
import type { NfeDetail, NfeQueryPort } from "../../domain/ports/nfe-query.port.js";

const nfeListInclude = {
  nfeReferencia: { select: { chave: true } },
  itens: { include: { product: true }, orderBy: { numeroItem: "asc" as const } },
};

function isShipmentWithFifoBalance(tipo: NFeTipo): boolean {
  return tipo === NFeTipo.REMESSA || tipo === NFeTipo.REMESSA_SIMBOLICA;
}

export class PrismaNfeQueryRepository implements NfeQueryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: string) {
    const rows = await this.prisma.nFe.findMany({
      where: { tenantId, ...fiscalNotDeleted },
      include: nfeListInclude,
      orderBy: [{ emitidaEm: "desc" }, { serie: "desc" }, { numero: "desc" }],
    });
    if (rows.length === 0) return [];

    await atualizarItensSaldoFifoParaNfes(this.prisma, tenantId, rows);
    return Promise.all(
      rows.map(async (row) => {
        const fifoBalance = isShipmentWithFifoBalance(row.tipo)
          ? await saldoLiquidoRemessaNfe(this.prisma, row.id, row.quantidade)
          : undefined;
        return mapNfe(row, row.nfeReferencia?.chave, row.itens, fifoBalance) as Record<
          string,
          unknown
        >;
      }),
    );
  }

  async getByAccessKey(tenantId: string, accessKey: string): Promise<NfeDetail | null> {
    const row = await this.prisma.nFe.findFirst({
      where: { chave: accessKey, tenantId, ...fiscalNotDeleted },
      include: {
        cteRemessa: { select: { chave: true } },
        cteVenda: { select: { chave: true } },
        nfeReferencia: { select: { chave: true, tipo: true, numero: true, serie: true } },
        nfeReferenciadas: { select: { chave: true, tipo: true, numero: true, serie: true } },
        itens: { include: { product: true }, orderBy: { numeroItem: "asc" } },
      },
    });
    if (!row) return null;

    if (isShipmentWithFifoBalance(row.tipo)) {
      await atualizarItensSaldoFifoParaNfes(this.prisma, tenantId, [row]);
    }
    const fifoBalance = isShipmentWithFifoBalance(row.tipo)
      ? await saldoLiquidoRemessaNfe(this.prisma, row.id, row.quantidade)
      : undefined;
    const dto = mapNfe(row, row.nfeReferencia?.chave, row.itens, fifoBalance);

    return {
      ...dto,
      cteChaveRef: row.cteRemessa?.chave ?? row.cteVenda?.chave,
      referenciadas: row.nfeReferenciadas.map((nfe) => ({
        chave: nfe.chave,
        tipo: nfe.tipo,
        numero: nfe.numero,
        serie: nfe.serie,
      })),
    };
  }

  async resolveXml(tenantId: string, accessKey: string) {
    return resolveNfeXml(this.prisma, tenantId, accessKey);
  }

  async getTipoWhenXmlMissing(tenantId: string, accessKey: string) {
    const row = await this.prisma.nFe.findFirst({
      where: { chave: accessKey, tenantId, ...fiscalNotDeleted },
      select: { tipo: true },
    });
    return row?.tipo ?? null;
  }
}
