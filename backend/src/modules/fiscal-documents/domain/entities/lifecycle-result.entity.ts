/** Reversal of FIFO shipment balance after cancellation or return. */
export interface ReversedShipmentBalance {
  remessaNfeId: string;
  quantidade: number;
}

/** Result of cancelling a sale NF-e and its symbolic return chain. */
export interface CancelDocumentResult {
  venda: Record<string, unknown>;
  retorno?: Record<string, unknown>;
  saldoEstornado: ReversedShipmentBalance[];
}

/** Result of processing a sale return (devolução). */
export interface ProcessReturnResult {
  devolucao: Record<string, unknown>;
  remessaSimbolica?: Record<string, unknown>;
  saldoEstornado: ReversedShipmentBalance[];
}

/** Result of inutilizing an unused NF-e number range. */
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
