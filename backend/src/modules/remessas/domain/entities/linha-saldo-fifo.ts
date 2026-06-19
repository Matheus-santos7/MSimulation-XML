import { quantidadeSaldo, type QuantidadeSaldo } from "../value-objects/quantidade-saldo.js";

/**
 * Linha de saldo FIFO — unidade mínima de estoque fiscal rastreável.
 *
 * Cada linha corresponde a **um item** (`nfe_itens`) de uma NF-e do tipo
 * `REMESSA` (física) ou `REMESSA_AVANCO` (avanço entre CDs). O saldo
 * representa quantas unidades daquele produto ainda podem ser consumidas
 * (venda full, retorno simbólico ou novo avanço) antes de esgotar a nota.
 *
 * **Ordem FIFO:** linhas com `emitidaEm` mais antigo são debitadas primeiro.
 * **Escopo por CD:** `unidadeDestinoId` é o CD onde o saldo está “parado”
 * (valor gravado na NF-e, pode divergir do catálogo atual após reimportação).
 */
export type LinhaSaldoFifo = {
  /** ID do registro `nfe_itens`. */
  id: string;
  tenantId: string;
  productId: string;
  /** NF-e de remessa (física ou simbólica) que originou o saldo. */
  remessaNfeId: string;
  /** CD de destino da remessa — filtro usado no avanço e listagem por CD. */
  unidadeDestinoId: string;
  /** Quantidade ainda disponível para débito (≥ 0, inteiro). */
  saldoDisponivel: QuantidadeSaldo;
  /** Data de emissão da NF-e pai — critério de ordenação FIFO. */
  emitidaEm: Date;
};

/**
 * Resultado de uma alocação FIFO: quanto foi debitado de cada linha.
 *
 * Persistido em `nfe_remessa_consumos` quando o débito está vinculado a um
 * retorno simbólico (`retornoNfeId`), permitindo estorno em cancelamentos.
 */
export type AlocacaoFifo = {
  remessaNfeId: string;
  nfeItemId: string;
  quantidade: QuantidadeSaldo;
};

/**
 * Factory de domínio: normaliza `saldoDisponivel` via value object.
 *
 * @param input.saldoDisponivel - Inteiro não negativo
 */
export function criarLinhaSaldoFifo(input: {
  id: string;
  tenantId: string;
  productId: string;
  remessaNfeId: string;
  unidadeDestinoId: string;
  saldoDisponivel: number;
  emitidaEm: Date;
}): LinhaSaldoFifo {
  return {
    ...input,
    saldoDisponivel: quantidadeSaldo(input.saldoDisponivel),
  };
}
