import type { PrismaClient } from "../../../../generated/prisma/client.js";
import type { PrismaTx } from "../../../../lib/db/prisma-tx.js";
import { criarLinhaSaldoFifo, type AlocacaoFifo } from "../../domain/entities/linha-saldo-fifo.js";
import type {
  EstoqueFifoRepository,
  ListarSaldoFifoFiltro,
} from "../../domain/ports/estoque-fifo-repository.js";
import {
  debitRemessaBalanceByCd,
  realignRemessaFifoProductIdsBySku,
  buildRemessaFifoItemsWhere,
} from "../fifo/remessa-fifo.js";
import { getDbClient } from "../../../../lib/db/tenant-rls.js";
type Db = PrismaClient | PrismaTx;

/**
 * Adapter: implementa EstoqueFifoRepository sobre nfe_itens + remessa-fifo legado.
 * Migração incremental — delega persistência ao código existente.
 */
export class PrismaEstoqueFifoRepository implements EstoqueFifoRepository {
  private get db() {
    return getDbClient();
  }

  async listarLinhasComSaldo(filtro: ListarSaldoFifoFiltro) {
    const where = await buildRemessaFifoItemsWhere(
      this.db,
      filtro.tenantId,
      filtro.productId,
      filtro.productSku,
      filtro.unidadeDestinoId,
    );

    const rows = await this.db.nfeItem.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        productId: true,
        saldoDisponivel: true,
        nfeId: true,
        nfe: { select: { emitidaEm: true, unidadeDestinoId: true } },
      },
      orderBy: [{ nfe: { emitidaEm: "asc" } }, { numeroItem: "asc" }],
    });

    return rows
      .filter((r) => r.nfe.unidadeDestinoId)
      .map((r) =>
        criarLinhaSaldoFifo({
          id: r.id,
          tenantId: r.tenantId,
          productId: r.productId,
          remessaNfeId: r.nfeId,
          unidadeDestinoId: r.nfe.unidadeDestinoId!,
          saldoDisponivel: r.saldoDisponivel ?? 0,
          emitidaEm: r.nfe.emitidaEm,
        }),
      );
  }

  async saldoTotal(filtro: ListarSaldoFifoFiltro): Promise<number> {
    const linhas = await this.listarLinhasComSaldo(filtro);
    return linhas.reduce((acc, l) => acc + l.saldoDisponivel, 0);
  }

  async aplicarDebito(tenantId: string, alocacoes: AlocacaoFifo[]): Promise<void> {
    for (const aloc of alocacoes) {
      const item = await this.db.nfeItem.findFirst({
        where: { id: aloc.nfeItemId, tenantId },
        select: { saldoDisponivel: true },
      });
      if (!item) continue;
      await this.db.nfeItem.update({
        where: { id: aloc.nfeItemId },
        data: { saldoDisponivel: (item.saldoDisponivel ?? 0) - aloc.quantidade },
      });
    }
  }

  async registrarConsumoRemessa(
    tenantId: string,
    retornoNfeId: string,
    alocacoes: AlocacaoFifo[],
  ): Promise<void> {
    for (const aloc of alocacoes) {
      await this.db.nfeRemessaConsumo.create({
        data: {
          retornoNfeId,
          remessaNfeId: aloc.remessaNfeId,
          nfeItemId: aloc.nfeItemId,
          quantidade: aloc.quantidade,
        },
      });
    }
  }

  async realinharProductIdPorSku(tenantId: string, sku: string): Promise<number> {
    const result = await realignRemessaFifoProductIdsBySku(this.db, tenantId, sku);
    return result.atualizados;
  }
}

/** Atalho logístico por CD — mantém compatibilidade com debitRemessaBalanceByCd. */
export async function debitarFifoPorCd(
  db: PrismaTx,
  tenantId: string,
  productId: string,
  quantidade: number,
  unidadeOrigemId: string,
) {
  return debitRemessaBalanceByCd(db, tenantId, productId, quantidade, unidadeOrigemId);
}

