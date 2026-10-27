import { Injectable } from "@nestjs/common";
import { FiscalStatus, NFeTipo, Prisma } from "../../../generated/prisma/client.js";
import { getDbClient } from "../../../lib/db/tenant-rls.js";
import type { NotaFiscal } from "./fiscal-chain.types.js";
import { persistirXmlFromEmission } from "./nfe-xml-persist.js";
import type { TipoNota } from "./rules/tipo-nota.js";
import type {
  PersistirNotaInput,
  PersistXmlFromEmissionInput,
} from "./types/fiscal-chain-note.types.js";

const NOTA_REFERENCIA_SELECT = { nfeReferencia: { select: { chave: true, tipo: true } } } as const;

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

/** NF-e da cadeia de remessas (retorno e remessa simbólicos do avanço). */
@Injectable()
export class FiscalChainNoteRepository {
  private get db() {
    return getDbClient();
  }

  /** Remessa (física ou de avanço) cuja linha FIFO foi debitada primeiro. */
  async findMainShipment(alocacoes: { remessaNfeId: string }[]): Promise<NotaFiscal | null> {
    const remessaNfeId = alocacoes[0]?.remessaNfeId;
    if (!remessaNfeId) return null;

    const row = await this.db.nFe.findFirst({
      where: {
        id: remessaNfeId,
        tipo: { in: [NFeTipo.REMESSA, NFeTipo.REMESSA_AVANCO] },
        deletedAt: null,
      },
      include: NOTA_REFERENCIA_SELECT,
    });

    return row ? mapRowToNota(row) : null;
  }

  async persist(input: PersistirNotaInput): Promise<NotaFiscal> {
    const row = await this.db.nFe.create({
      data: {
        tenantId: input.tenantId,
        marketplace: input.marketplace,
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
        tipo: input.tipo as NFeTipo,
        saldoDisponivel: null,
        nfeReferenciaId: input.referencia?.notaPaiId ?? null,
        unidadeOrigemId: input.unidadeOrigemId,
        unidadeDestinoId: input.unidadeDestinoId,
        fiscalPayload: input.fiscalPayload as Prisma.InputJsonValue,
      },
      include: NOTA_REFERENCIA_SELECT,
    });

    return mapRowToNota(row);
  }

  persistXmlFromEmission(input: PersistXmlFromEmissionInput): Promise<void> {
    return persistirXmlFromEmission(this.db, input);
  }
}
