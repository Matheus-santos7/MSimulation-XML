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
