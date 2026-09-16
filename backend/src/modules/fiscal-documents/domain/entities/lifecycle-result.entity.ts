/** Estorno de saldo FIFO na remessa após cancelamento ou devolução. */
export interface ReversedShipmentBalance {
  remessaNfeId: string;
  quantidade: number;
}

/** Resultado do cancelamento de venda + retorno simbólico + CT-e. */
export interface CancelDocumentResult {
  venda: Record<string, unknown>;
  retorno?: Record<string, unknown>;
  saldoEstornado: ReversedShipmentBalance[];
}

/** Resultado da devolução de venda (NF-e DEVOLUÇÃO + remessa simbólica opcional). */
export interface ProcessReturnResult {
  devolucao: Record<string, unknown>;
  remessaSimbolica?: Record<string, unknown>;
  saldoEstornado: ReversedShipmentBalance[];
}

/** Linha da venda com o que já foi devolvido e o que ainda pode ser devolvido. */
export interface ReturnableItem {
  numeroItem: number;
  productId: string;
  sku: string | null;
  nome: string;
  unidade: string;
  quantidadeVendida: number;
  quantidadeDevolvida: number;
  quantidadeDisponivel: number;
  valorUnitario: number;
}

/** Situação de devolução de uma venda (GET /nfes/:chave/devolucao). */
export interface ReturnableItemsResult {
  venda: { chave: string; numero: number; serie: number; quantidade: number };
  itens: ReturnableItem[];
  quantidadeDevolvida: number;
  quantidadeDisponivel: number;
  devolucoes: Array<{
    chave: string;
    numero: number;
    serie: number;
    tipo: string;
    quantidade: number;
  }>;
}

/** Resultado da inutilização de numeração (registo administrativo, não é NF-e). */
export interface InutilizationResult {
  id: string;
  tipo: "INUT";
  descricao: string;
  serie: number;
  numeroIni: number;
  numeroFim: number;
  xJust: string;
  protocolo: string;
  ocorridoEm: string;
}
