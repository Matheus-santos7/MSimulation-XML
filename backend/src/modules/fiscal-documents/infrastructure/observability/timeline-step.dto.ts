import type { FiscalStatus, NFeTipo } from "../../../../generated/prisma/client.js";

export type TimelineNfeStepDto = {
  kind: "nfe";
  tipo: NFeTipo;
  tipoLabel: string;
  chave: string;
  numero: number;
  serie: number;
  emitidaEm: string;
  quantidade: number;
  status: FiscalStatus;
  saldoDisponivel?: number;
  nfeReferenciaChave?: string;
};

export type TimelineEventStepDto = {
  kind: "event";
  eventTipo: "INUT" | "110111";
  eventId: string;
  eventLabel: string;
  serie: number;
  numero: number;
  numeroFim?: number;
  ocorridoEm: string;
  chaveRef?: string;
};

export type TimelineChainStepDto = TimelineNfeStepDto | TimelineEventStepDto;

/** Um cenário = uma cadeia derivada de uma remessa: remessa → retorno → venda [→ devolução]. */
export type TimelineChainDto = {
  id: string;
  pedidoMl?: string;
  emitidaEm: string;
  status: "completa" | "parcial" | "cancelada";
  steps: TimelineChainStepDto[];
};

/**
 * Agrupamento por remessa. A mesma remessa (ex.: 4 und) alimenta vários cenários,
 * por isso ela se repete no início de cada cenário do grupo.
 */
export type TimelineRemessaGroupDto = {
  /** Vazio quando a venda não tem remessa na cadeia (venda avulsa / checkout direto). */
  remessaChave: string;
  remessaNumero?: number;
  remessaSerie?: number;
  emitidaEm: string;
  quantidadeRemessa?: number;
  saldoDisponivel?: number;
  cenarios: TimelineChainDto[];
};
