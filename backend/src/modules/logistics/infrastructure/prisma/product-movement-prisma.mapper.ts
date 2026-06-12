import type { OperacaoFiscalTipo } from "../../../../generated/prisma/client.js";
import type { ProductMovement } from "../../domain/entities/product-movement.entity.js";

export function mapProductMovementFromPrisma(row: {
  id: string;
  tipoOperacao: OperacaoFiscalTipo;
  quantidade: number;
  unidadeOrigemId: string | null;
  unidadeDestinoId: string | null;
  nfeId: string;
  nfeSecundariaId: string | null;
  observacao: string | null;
  createdAt: Date;
  unidadeOrigem?: { codigo: string; nome: string } | null;
  unidadeDestino?: { codigo: string; nome: string } | null;
  nfe?: { chave: string; tipo: string; numero: number; serie: number } | null;
  nfeSecundaria?: { chave: string; tipo: string; numero: number; serie: number } | null;
}): ProductMovement {
  return {
    id: row.id,
    tipoOperacao: row.tipoOperacao,
    quantidade: row.quantidade,
    unidadeOrigemId: row.unidadeOrigemId ?? undefined,
    unidadeDestinoId: row.unidadeDestinoId ?? undefined,
    unidadeOrigem: row.unidadeOrigem
      ? { codigo: row.unidadeOrigem.codigo, nome: row.unidadeOrigem.nome }
      : undefined,
    unidadeDestino: row.unidadeDestino
      ? { codigo: row.unidadeDestino.codigo, nome: row.unidadeDestino.nome }
      : undefined,
    nfeId: row.nfeId,
    nfeSecundariaId: row.nfeSecundariaId ?? undefined,
    nfe: row.nfe
      ? { chave: row.nfe.chave, tipo: row.nfe.tipo, numero: row.nfe.numero, serie: row.nfe.serie }
      : undefined,
    nfeSecundaria: row.nfeSecundaria
      ? {
          chave: row.nfeSecundaria.chave,
          tipo: row.nfeSecundaria.tipo,
          numero: row.nfeSecundaria.numero,
          serie: row.nfeSecundaria.serie,
        }
      : undefined,
    observacao: row.observacao ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
