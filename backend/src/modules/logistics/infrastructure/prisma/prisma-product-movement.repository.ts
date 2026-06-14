import type { OperacaoFiscalTipo, PrismaClient } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import type {
  ListProductMovementsFilter,
  ProductMovementRepository,
  RegisterProductMovementData,
} from "../../domain/ports/product-movement.repository.js";
import { mapProductMovementFromPrisma } from "./product-movement-prisma.mapper.js";

/**
 * Implementação Prisma de movimentações de produto (`movimentacao_produto`).
 */
export class PrismaProductMovementRepository implements ProductMovementRepository {
  constructor(private readonly prisma: DbClient) {}

  async listByTenant(tenantId: string, filter?: ListProductMovementsFilter) {
    const rows = await this.prisma.movimentacaoProduto.findMany({
      where: {
        tenantId,
        ...(filter?.productId ? { productId: filter.productId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: filter?.limit ?? 100,
      include: {
        unidadeOrigem: { select: { codigo: true, nome: true } },
        unidadeDestino: { select: { codigo: true, nome: true } },
        nfe: { select: { chave: true, tipo: true, numero: true, serie: true } },
        nfeSecundaria: { select: { chave: true, tipo: true, numero: true, serie: true } },
      },
    });
    return rows.map(mapProductMovementFromPrisma);
  }

  async register(data: RegisterProductMovementData, db?: unknown): Promise<void> {
    const client = (db ?? this.prisma) as PrismaClient | PrismaTx;
    await client.movimentacaoProduto.create({
      data: {
        tenantId: data.tenantId,
        productId: data.productId,
        tipoOperacao: data.tipoOperacao as OperacaoFiscalTipo,
        quantidade: data.quantidade,
        nfeId: data.nfeId,
        unidadeOrigemId: data.unidadeOrigemId ?? undefined,
        unidadeDestinoId: data.unidadeDestinoId ?? undefined,
        nfeSecundariaId: data.nfeSecundariaId ?? undefined,
        observacao: data.observacao ?? undefined,
      },
    });
  }
}
