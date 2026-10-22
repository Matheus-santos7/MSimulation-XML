import type { QuantidadeSaldo } from "./rules/quantidade-saldo.js";

/**
 * Quanto foi debitado de cada linha FIFO (`nfe_itens` de uma remessa).
 *
 * Persistido em `nfe_remessa_consumos` quando o débito está vinculado a um
 * retorno simbólico (`retornoNfeId`), permitindo estorno em cancelamentos.
 */
export type AlocacaoFifo = {
  remessaNfeId: string;
  nfeItemId: string;
  quantidade: QuantidadeSaldo;
};
