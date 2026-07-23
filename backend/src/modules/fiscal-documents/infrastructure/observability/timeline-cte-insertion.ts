import { FiscalStatus, NFeTipo } from "../../../../generated/prisma/client.js";
import type {
  TimelineChainStepDto,
  TimelineCteStepDto,
  TimelineNfeStepDto,
} from "./timeline-step.dto.js";

export type TimelineCteRef = {
  id: string;
  chave: string;
  numero: number;
  serie: number;
  emitidoEm: Date;
  status: FiscalStatus;
  nfeRemessaId: string | null;
  nfeVendaId: string | null;
};

function mapCteStep(cte: TimelineCteRef): TimelineCteStepDto {
  return {
    kind: "cte",
    chave: cte.chave,
    numero: cte.numero,
    serie: cte.serie,
    emitidaEm: cte.emitidoEm.toISOString(),
    status: cte.status,
    label: "CT-e",
  };
}

/**
 * Insere passos de CT-e imediatamente após a NF-e de remessa e/ou venda vinculada.
 */
export function insertCteStepsIntoChain(
  steps: TimelineChainStepDto[],
  ctes: TimelineCteRef[],
  nfeChaveToId: ReadonlyMap<string, string>,
): TimelineChainStepDto[] {
  if (ctes.length === 0) return steps;

  const byRemessaId = new Map<string, TimelineCteRef>();
  const byVendaId = new Map<string, TimelineCteRef>();
  for (const cte of ctes) {
    if (cte.nfeRemessaId) byRemessaId.set(cte.nfeRemessaId, cte);
    if (cte.nfeVendaId) byVendaId.set(cte.nfeVendaId, cte);
  }

  const out: TimelineChainStepDto[] = [];
  for (const step of steps) {
    out.push(step);
    if (step.kind !== "nfe") continue;

    const nfeId = nfeChaveToId.get(step.chave);
    if (!nfeId) continue;

    const nfe = step as TimelineNfeStepDto;
    if (nfe.tipo === NFeTipo.REMESSA || nfe.tipo === NFeTipo.REMESSA_AVANCO) {
      const cte = byRemessaId.get(nfeId);
      if (cte) out.push(mapCteStep(cte));
    }
    if (nfe.tipo === NFeTipo.VENDA) {
      const cte = byVendaId.get(nfeId);
      if (cte) out.push(mapCteStep(cte));
    }
  }
  return out;
}
