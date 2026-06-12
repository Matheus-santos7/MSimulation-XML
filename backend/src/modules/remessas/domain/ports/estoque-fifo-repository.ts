import type { AlocacaoFifo, LinhaSaldoFifo } from "../entities/linha-saldo-fifo.js";

/**
 * Filtro para consulta de saldo FIFO por produto e, opcionalmente, por CD.
 *
 * `productSku` permite reunir linhas legadas após reimportação de catálogo
 * (mesmo SKU, `productId` diferente).
 */
export type ListarSaldoFifoFiltro = {
  tenantId: string;
  productId: string;
  productSku?: string;
  /** Restringe linhas ao CD de destino da NF-e (`unidade_destino_id`). */
  unidadeDestinoId?: string;
};

/**
 * Port de persistência do estoque FIFO (camada de infraestrutura → `nfe_itens`).
 *
 * Responsabilidades:
 * - Listar {@link LinhaSaldoFifo} com saldo > 0, ordenadas por emissão (FIFO)
 * - Debitar saldo nas linhas (`aplicarDebito` / fluxos legados em `remessa-fifo`)
 * - Registrar consumos em `nfe_remessa_consumos` para auditoria e estorno
 * - Realinhar `product_id` por SKU quando o cadastro mudou
 *
 * O **algoritmo FIFO puro** vive em {@link TransferidorSaldoFifo}; este port
 * apenas materializa leituras e escritas no banco.
 */
export interface EstoqueFifoRepository {
  /**
   * Lista linhas com saldo disponível, já mapeadas para o domínio.
   * Ordem: `emitidaEm` ascendente (mais antiga primeiro).
   */
  listarLinhasComSaldo(filtro: ListarSaldoFifoFiltro): Promise<LinhaSaldoFifo[]>;

  /** Soma `saldoDisponivel` de todas as linhas que passam no filtro. */
  saldoTotal(filtro: ListarSaldoFifoFiltro): Promise<number>;

  /**
   * Reduz `saldo_disponivel` nas linhas indicadas pelas alocações.
   * Usado quando o débito já foi calculado em memória.
   *
   * @param vinculo.retornoNfeId - Quando presente, também cria `nfe_remessa_consumos`
   */
  aplicarDebito(
    tenantId: string,
    alocacoes: AlocacaoFifo[],
    vinculo?: { retornoNfeId: string },
  ): Promise<void>;

  /**
   * Registra vínculo retorno → remessa debitada (auditoria + estorno em cancelamento).
   * Chamado após emitir retorno simbólico no avanço de mercadoria.
   */
  registrarConsumoRemessa(
    tenantId: string,
    retornoNfeId: string,
    alocacoes: AlocacaoFifo[],
  ): Promise<void>;

  /**
   * Atualiza `nfe_itens.product_id` para o cadastro atual do SKU.
   * @returns Quantidade de linhas corrigidas
   */
  realinharProductIdPorSku(tenantId: string, sku: string): Promise<number>;
}
