/**
 * Linha comercial de um item fiscal (produto × quantidade × valor unitário).
 *
 * Entrada do tax-calculation.service antes de virar {@link ItemFiscalInput}.
 */
export type OrderLine = {
  numeroItem?: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  cest?: string;
  ean?: string;
  exTipi?: string;
  origem: number;
  quantidade: number;
  valorUnitario: number;
  frete?: number;
  seguro?: number;
  despesasAcessorias?: number;
  desconto?: number;
};
