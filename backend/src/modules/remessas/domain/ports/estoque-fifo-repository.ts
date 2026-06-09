import type { AlocacaoFifo, LinhaSaldoFifo } from "../entities/linha-saldo-fifo.js";

export type ListarSaldoFifoFiltro = {
  tenantId: string;
  productId: string;
  productSku?: string;
  unidadeDestinoId?: string;
};

/** Porta de saída: persistência e consulta de estoque FIFO (logística). */
export interface EstoqueFifoRepository {
  listarLinhasComSaldo(filtro: ListarSaldoFifoFiltro): Promise<LinhaSaldoFifo[]>;

  saldoTotal(filtro: ListarSaldoFifoFiltro): Promise<number>;

  aplicarDebito(
    tenantId: string,
    alocacoes: AlocacaoFifo[],
    vinculo?: { retornoNfeId: string },
  ): Promise<void>;

  registrarConsumoRemessa(
    tenantId: string,
    retornoNfeId: string,
    alocacoes: AlocacaoFifo[],
  ): Promise<void>;

  realinharProductIdPorSku(tenantId: string, sku: string): Promise<number>;
}
