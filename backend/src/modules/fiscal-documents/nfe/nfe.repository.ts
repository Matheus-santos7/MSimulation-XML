import { Injectable } from "@nestjs/common";
import { NFeTipo } from "../../../generated/prisma/client.js";
import { mapNfe } from "../shared/fiscal-document.mapper.js";
import { fiscalNotDeleted } from "../shared/fiscal-not-deleted.js";
import { resolveNfeCancelamentoEventoXml, resolveNfeXml } from "./xml/nfe-xml.service.js";
import { refreshRemessaFifoItemsForNfes, getNetRemessaNfeBalance } from "../../remessas/index.js";
import type { ListNfesFilter, NfeDetail } from "./nfe.types.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import { resolveNfeReferenciaChaves } from "./rules/nfe-referencia-chaves.js";

const RETURN_TIPOS_WITH_CONSUMO: ReadonlySet<NFeTipo> = new Set([
  NFeTipo.RETORNO_SIMBOLICO,
  NFeTipo.RETORNO_FISICO,
]);

const nfeListInclude = {
  nfeReferencia: { select: { chave: true } },
  itens: { include: { product: true }, orderBy: { numeroItem: "asc" as const } },
};

function isShipmentWithFifoBalance(tipo: NFeTipo): boolean {
  return tipo === NFeTipo.REMESSA || tipo === NFeTipo.REMESSA_AVANCO;
}

@Injectable()
export class NfeRepository {
  private get db() {
    return getDbClient();
  }

  async list(tenantId: string, filter: ListNfesFilter = {}) {
    const rows = await this.db.nFe.findMany({
      where: {
        tenantId,
        ...fiscalNotDeleted,
        ...(filter.marketplace ? { marketplace: filter.marketplace } : {}),
      },
      // Listagem não precisa do XML autorizado (texto grande) — baixa payload Neon→API.
      omit: { xmlAutorizado: true },
      include: nfeListInclude,
      orderBy: [{ emitidaEm: "desc" }, { serie: "desc" }, { numero: "desc" }],
    });
    if (rows.length === 0) return [];

    // Sem reconcile FIFO no GET (write-on-read): saldo vem dos itens já carregados via mapNfe.
    // Reconcile permanece no detalhe / mutações de remessa.
    return rows.map(
      (row) => mapNfe(row, row.nfeReferencia?.chave, row.itens) as Record<string, unknown>,
    );
  }

  async getByAccessKey(tenantId: string, accessKey: string): Promise<NfeDetail | null> {
    const row = await this.db.nFe.findFirst({
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
      await refreshRemessaFifoItemsForNfes(this.db, tenantId, [row]);
    }
    const fifoBalance = isShipmentWithFifoBalance(row.tipo)
      ? await getNetRemessaNfeBalance(this.db, row.id, row.quantidade)
      : undefined;

    let referenciaChaves: string | string[] | undefined = row.nfeReferencia?.chave;
    if (RETURN_TIPOS_WITH_CONSUMO.has(row.tipo)) {
      const consumos = await this.db.nfeRemessaConsumo.findMany({
        where: { retornoNfeId: row.id },
        include: { remessaNfe: { select: { chave: true } } },
        orderBy: { createdAt: "asc" },
      });
      const resolved = resolveNfeReferenciaChaves({
        primaryChave: row.nfeReferencia?.chave,
        consumoChaves: consumos.map((c) => c.remessaNfe.chave),
      });
      if (resolved.length > 0) {
        referenciaChaves = resolved.length === 1 ? resolved[0]! : resolved;
      }
    }

    const dto = mapNfe(row, referenciaChaves, row.itens, fifoBalance);
    const chavesLista = Array.isArray(referenciaChaves)
      ? referenciaChaves
      : referenciaChaves
        ? [referenciaChaves]
        : [];

    return {
      ...dto,
      nfeReferenciaChaves: chavesLista.length > 0 ? chavesLista : undefined,
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
    return resolveNfeXml(this.db, tenantId, accessKey);
  }

  async resolveCancelamentoEventoXml(tenantId: string, accessKey: string) {
    return resolveNfeCancelamentoEventoXml(this.db, tenantId, accessKey);
  }

  async getTipoWhenXmlMissing(tenantId: string, accessKey: string) {
    const row = await this.db.nFe.findFirst({
      where: { chave: accessKey, tenantId, ...fiscalNotDeleted },
      select: { tipo: true },
    });
    return row?.tipo ?? null;
  }

  /** Exclusão lógica; `false` quando a NF-e não existe ou já foi excluída. */
  async softDelete(accessKey: string, tenantId: string): Promise<boolean> {
    const existing = await this.db.nFe.findFirst({ where: { chave: accessKey, tenantId } });
    if (!existing || existing.deletedAt) return false;

    await this.db.nFe.update({
      where: { chave: accessKey },
      data: { deletedAt: new Date() },
    });

    return true;
  }
}
