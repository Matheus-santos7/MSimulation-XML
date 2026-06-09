import { quantidadeSaldo, type QuantidadeSaldo } from "../value-objects/quantidade-saldo.js";

/** Linha de saldo FIFO (1 item de NF-e de remessa física). */
export type LinhaSaldoFifo = {
  id: string;
  tenantId: string;
  productId: string;
  remessaNfeId: string;
  unidadeDestinoId: string;
  saldoDisponivel: QuantidadeSaldo;
  emitidaEm: Date;
};

export type AlocacaoFifo = {
  remessaNfeId: string;
  nfeItemId: string;
  quantidade: QuantidadeSaldo;
};

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
