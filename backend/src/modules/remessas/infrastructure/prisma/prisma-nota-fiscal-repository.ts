import {
  FiscalStatus,
  NFeTipo,
  Prisma,
  type PrismaClient,
  type Tenant,
} from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import type { NotaFiscal } from "../../domain/entities/nota-fiscal.js";
import {
  notaPersistida,
  type NotaFiscalRepository,
  type PersistirNotaInput,
} from "../../domain/ports/nota-fiscal-repository.js";
import type { TipoNota } from "../../domain/value-objects/tipo-nota.js";
import { persistirXmlFromEmission } from "./nfe-xml-persist.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";

type Db = PrismaClient | PrismaTx;

function mapTipoToPrisma(tipo: TipoNota): NFeTipo {
  return tipo as NFeTipo;
}

function mapRowToNota(row: {
  id: string;
  tenantId: string;
  productId: string | null;
  tipo: NFeTipo;
  chave: string;
  numero: number;
  serie: number;
  quantidade: number;
  unidadeOrigemId: string | null;
  unidadeDestinoId: string | null;
  nfeReferenciaId: string | null;
  nfeReferencia?: { chave: string; tipo: NFeTipo } | null;
}): NotaFiscal {
  return {
    id: row.id,
    tenantId: row.tenantId,
    productId: row.productId ?? "",
    tipo: row.tipo as TipoNota,
    chave: row.chave,
    numero: row.numero,
    serie: row.serie,
    quantidade: row.quantidade,
    unidadeOrigemId: row.unidadeOrigemId,
    unidadeDestinoId: row.unidadeDestinoId,
    referencia: row.nfeReferenciaId
      ? {
          notaPaiId: row.nfeReferenciaId,
          notaPaiChave: row.nfeReferencia?.chave ?? "",
          notaPaiTipo: (row.nfeReferencia?.tipo ?? "REMESSA") as TipoNota,
        }
      : null,
  };
}

export class PrismaNotaFiscalRepository implements NotaFiscalRepository {
  private get db() {
    return getDbClient();
  }

  async buscarPorId(tenantId: string, notaId: string): Promise<NotaFiscal | null> {
    const row = await this.db.nFe.findFirst({
      where: { id: notaId, tenantId, deletedAt: null },
      include: { nfeReferencia: { select: { chave: true, tipo: true } } },
    });
    return row ? mapRowToNota(row) : null;
  }

  async buscarRemessaPrincipal(
    alocacoes: { remessaNfeId: string }[],
  ): Promise<NotaFiscal | null> {
    const remessaNfeId = alocacoes[0]?.remessaNfeId;
    if (!remessaNfeId) return null;

    const row = await this.db.nFe.findFirst({
      where: {
        id: remessaNfeId,
        tipo: { in: [NFeTipo.REMESSA, NFeTipo.REMESSA_AVANCO] },
        deletedAt: null,
      },
      include: { nfeReferencia: { select: { chave: true, tipo: true } } },
    });
    return row ? mapRowToNota(row) : null;
  }

  async persistir(input: PersistirNotaInput): Promise<NotaFiscal> {
    const row = await this.db.nFe.create({
      data: {
        tenantId: input.tenantId,
        productId: input.productId,
        chave: input.chave,
        numero: input.numero,
        serie: input.serie,
        natOp: input.natOp,
        cfop: input.cfop,
        ncm: input.ncm,
        ...input.destino,
        valor: input.valor,
        valorIcms: input.valorIcms,
        aliqIcms: input.aliqIcms,
        status: FiscalStatus.AUTORIZADA,
        emitidaEm: new Date(),
        pedidoMl: input.pedidoMl,
        quantidade: input.quantidade,
        tipo: mapTipoToPrisma(input.tipo),
        saldoDisponivel: null,
        nfeReferenciaId: input.referencia?.notaPaiId ?? null,
        unidadeOrigemId: input.unidadeOrigemId,
        unidadeDestinoId: input.unidadeDestinoId,
        fiscalPayload: input.fiscalPayload as Prisma.InputJsonValue,
      },
      include: { nfeReferencia: { select: { chave: true, tipo: true } } },
    });

    return mapRowToNota(row);
  }

  async persistirXmlAutorizado(notaId: string, xml: string): Promise<void> {
    await this.db.nFe.update({
      where: { id: notaId },
      data: { xmlAutorizado: xml },
    });
  }

  async persistirXmlFromEmission(input: {
    nfeId: string;
    tenant: Tenant;
    productId: string;
    nfeReferenciaChave?: string;
  }): Promise<void> {
    await persistirXmlFromEmission(this.db, input);
  }
}
