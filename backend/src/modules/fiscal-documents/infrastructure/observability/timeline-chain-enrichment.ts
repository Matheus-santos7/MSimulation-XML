import { NFeTipo } from "../../../../generated/prisma/client.js";
import type {
  TimelineChainStepDto,
  TimelineEventStepDto,
  TimelineNfeStepDto,
} from "./timeline-step.dto.js";

export type InutilizationRef = {
  id: string;
  serie: number;
  numeroIni: number;
  numeroFim: number;
  ocorridoEm: Date;
};

export type CancellationRef = {
  id: string;
  chave: string;
  ocorridoEm: Date;
};

type SortableItem = {
  sortNumero: number;
  sortTie: number;
  step: TimelineChainStepDto;
};

const CANCELLABLE_TIPOS = new Set<NFeTipo>([NFeTipo.VENDA, NFeTipo.RETORNO_SIMBOLICO]);

/**
 * Insere na cadeia eventos de inutilização (faixas sequenciais ou anteriores ao cenário)
 * e cancelamentos de venda/retorno simbólico, ordenados por número de série.
 *
 * @param nfeSteps - Passos documentais do cenário (sem eventos).
 * @param inutilizations - Registros `nfe_inutilizacao` do tenant.
 * @param cancellationsByChave - Eventos 110111 indexados pela chave da NF-e cancelada.
 * @returns Cadeia unificada (NF-e + eventos) ordenada numericamente.
 */
export function enrichScenarioStepsWithEvents(
  nfeSteps: TimelineNfeStepDto[],
  inutilizations: InutilizationRef[],
  cancellationsByChave: Map<string, CancellationRef>,
): TimelineChainStepDto[] {
  if (nfeSteps.length === 0) return [];

  const series = new Set(nfeSteps.map((step) => step.serie));
  const minNumero = Math.min(...nfeSteps.map((step) => step.numero));
  const maxNumero = Math.max(...nfeSteps.map((step) => step.numero));

  const items: SortableItem[] = [];

  for (const nfe of nfeSteps) {
    items.push({ sortNumero: nfe.numero, sortTie: 0, step: nfe });

    const cancellation = cancellationsByChave.get(nfe.chave);
    if (!cancellation || !CANCELLABLE_TIPOS.has(nfe.tipo)) continue;

    const cancelStep: TimelineEventStepDto = {
      kind: "event",
      eventTipo: "110111",
      eventId: cancellation.id,
      eventLabel: "Cancelamento",
      serie: nfe.serie,
      numero: nfe.numero,
      ocorridoEm: cancellation.ocorridoEm.toISOString(),
      chaveRef: nfe.chave,
    };
    items.push({ sortNumero: nfe.numero, sortTie: 1, step: cancelStep });
  }

  for (const inut of inutilizations) {
    if (!series.has(inut.serie)) continue;

    const isPriorToScenario = inut.numeroFim < minNumero;
    const overlapsScenario = inut.numeroIni <= maxNumero && inut.numeroFim >= minNumero;
    if (!isPriorToScenario && !overlapsScenario) continue;

    const inutStep: TimelineEventStepDto = {
      kind: "event",
      eventTipo: "INUT",
      eventId: inut.id,
      eventLabel: "Inutilização",
      serie: inut.serie,
      numero: inut.numeroIni,
      numeroFim: inut.numeroFim !== inut.numeroIni ? inut.numeroFim : undefined,
      ocorridoEm: inut.ocorridoEm.toISOString(),
    };
    items.push({
      sortNumero: inut.numeroIni,
      sortTie: isPriorToScenario ? -1 : 0.5,
      step: inutStep,
    });
  }

  items.sort((a, b) => {
    if (a.sortNumero !== b.sortNumero) return a.sortNumero - b.sortNumero;
    return a.sortTie - b.sortTie;
  });

  return items.map((item) => item.step);
}
