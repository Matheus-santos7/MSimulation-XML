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
 * Parte uma faixa [ini, fim] removendo números ocupados por NF-e do cenário.
 * Ex.: ocupados {10,12}, faixa 10–13 → [11–11], [13–13].
 */
export function splitInutilizationAroundOccupied(
  numeroIni: number,
  numeroFim: number,
  occupied: ReadonlySet<number>,
): Array<{ numeroIni: number; numeroFim: number }> {
  const ini = Math.min(numeroIni, numeroFim);
  const fim = Math.max(numeroIni, numeroFim);
  const segments: Array<{ numeroIni: number; numeroFim: number }> = [];
  let start: number | null = null;

  for (let n = ini; n <= fim; n++) {
    if (occupied.has(n)) {
      if (start != null) {
        segments.push({ numeroIni: start, numeroFim: n - 1 });
        start = null;
      }
      continue;
    }
    if (start == null) start = n;
  }
  if (start != null) {
    segments.push({ numeroIni: start, numeroFim: fim });
  }
  return segments;
}

/**
 * Insere na cadeia eventos de inutilização (lacunas / anteriores ao cenário)
 * e cancelamentos de venda/retorno simbólico, ordenados por número.
 *
 * Inutilizações **não** repetem números já presentes como NF-e no cenário
 * (comum quando houve emissão após inutilização inconsistente).
 */
export function enrichScenarioStepsWithEvents(
  nfeSteps: TimelineNfeStepDto[],
  inutilizations: InutilizationRef[],
  cancellationsByChave: Map<string, CancellationRef>,
): TimelineChainStepDto[] {
  if (nfeSteps.length === 0) return [];

  const series = new Set(nfeSteps.map((step) => step.serie));
  const occupiedNumeros = new Set(nfeSteps.map((step) => step.numero));
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

    const segments = splitInutilizationAroundOccupied(
      inut.numeroIni,
      inut.numeroFim,
      occupiedNumeros,
    );

    for (const segment of segments) {
      const segmentPrior = segment.numeroFim < minNumero;
      const segmentOverlaps =
        segment.numeroIni <= maxNumero && segment.numeroFim >= minNumero;
      if (!segmentPrior && !segmentOverlaps) continue;

      const inutStep: TimelineEventStepDto = {
        kind: "event",
        eventTipo: "INUT",
        eventId: inut.id,
        eventLabel: "Inutilização",
        serie: inut.serie,
        numero: segment.numeroIni,
        numeroFim: segment.numeroFim !== segment.numeroIni ? segment.numeroFim : undefined,
        ocorridoEm: inut.ocorridoEm.toISOString(),
      };
      items.push({
        sortNumero: segment.numeroIni,
        sortTie: segmentPrior ? -1 : 0.5,
        step: inutStep,
      });
    }
  }

  items.sort((a, b) => {
    if (a.sortNumero !== b.sortNumero) return a.sortNumero - b.sortNumero;
    return a.sortTie - b.sortTie;
  });

  return items.map((item) => item.step);
}
