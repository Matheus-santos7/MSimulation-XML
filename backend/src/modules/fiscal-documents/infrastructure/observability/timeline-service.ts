import { FiscalStatus, NFeTipo } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { labelNfeTipo } from "../../presentation/mappers/fiscal-mappers.js";
import { fiscalNotDeleted } from "../../domain/constants/fiscal-not-deleted.js";
import {
  enrichScenarioStepsWithEvents,
  type CancellationRef,
  type InutilizationRef,
} from "./timeline-chain-enrichment.js";
import type {
  TimelineChainDto,
  TimelineChainStepDto,
  TimelineNfeStepDto,
  TimelineRemessaGroupDto,
} from "./timeline-step.dto.js";

export type {
  TimelineChainDto,
  TimelineChainStepDto,
  TimelineEventStepDto,
  TimelineNfeStepDto,
  TimelineRemessaGroupDto,
} from "./timeline-step.dto.js";

type ChainNode = {
  id: string;
  tipo: NFeTipo;
  chave: string;
  numero: number;
  serie: number;
  emitidaEm: Date;
  quantidade: number;
  saldoDisponivel: number | null;
  status: FiscalStatus;
  pedidoMl: string;
  nfeReferenciaId: string | null;
  nfeReferencia?: { chave: string } | null;
  itens?: { saldoDisponivel: number | null }[];
};

function saldoFifoNota(nfe: ChainNode): number | undefined {
  if (nfe.tipo !== NFeTipo.REMESSA && nfe.tipo !== NFeTipo.REMESSA_SIMBOLICA) {
    return undefined;
  }
  if (nfe.itens && nfe.itens.length > 0) {
    return nfe.itens.reduce((acc, item) => acc + (item.saldoDisponivel ?? 0), 0);
  }
  return nfe.saldoDisponivel ?? 0;
}

function mapStep(nfe: ChainNode): TimelineNfeStepDto {
  return {
    kind: "nfe",
    tipo: nfe.tipo,
    tipoLabel: labelNfeTipo(nfe.tipo),
    chave: nfe.chave,
    numero: nfe.numero,
    serie: nfe.serie,
    emitidaEm: nfe.emitidaEm.toISOString(),
    quantidade: nfe.quantidade,
    status: nfe.status,
    saldoDisponivel: saldoFifoNota(nfe),
    nfeReferenciaChave: nfe.nfeReferencia?.chave,
  };
}

function resolveScenarioStatus(steps: TimelineNfeStepDto[]): TimelineChainDto["status"] {
  const venda = steps.find((s) => s.tipo === NFeTipo.VENDA);
  const retorno = steps.find((s) => s.tipo === NFeTipo.RETORNO_SIMBOLICO);

  if (venda?.status === FiscalStatus.CANCELADA) return "cancelada";
  if (venda && retorno) return "completa";
  return "parcial";
}

/** Monta um cenário subindo pela referência: venda → retorno → remessa; anexa devoluções. */
function buildChainFromVenda(venda: ChainNode, byId: Map<string, ChainNode>): TimelineChainDto {
  const nfeSteps: TimelineNfeStepDto[] = [];
  let cur: ChainNode | undefined = byId.get(venda.id);

  while (cur) {
    nfeSteps.unshift(mapStep(cur));
    cur = cur.nfeReferenciaId ? byId.get(cur.nfeReferenciaId) : undefined;
  }

  const todos = [...byId.values()];
  const devolucoes = todos.filter(
    (n) => n.tipo === NFeTipo.DEVOLUCAO && n.nfeReferenciaId === venda.id,
  );
  for (const dev of devolucoes) {
    nfeSteps.push(mapStep(dev));
    const simbolicas = todos.filter(
      (n) => n.tipo === NFeTipo.REMESSA_SIMBOLICA && n.nfeReferenciaId === dev.id,
    );
    for (const simb of simbolicas) nfeSteps.push(mapStep(simb));
  }

  return {
    id: venda.id,
    pedidoMl: venda.pedidoMl,
    emitidaEm: venda.emitidaEm.toISOString(),
    status: resolveScenarioStatus(nfeSteps),
    steps: nfeSteps,
  };
}

async function loadTimelineEventRefs(
  db: DbClient,
  tenantId: string,
): Promise<{
  inutilizations: InutilizationRef[];
  cancellationsByChave: Map<string, CancellationRef>;
}> {
  const [inutilizations, cancellationEvents] = await Promise.all([
    db.nfeInutilizacao.findMany({
      where: { tenantId },
      orderBy: { numeroIni: "asc" },
    }),
    db.fiscalEvent.findMany({
      where: { tenantId, tipo: "110111" },
      include: { nfe: { select: { chave: true } } },
    }),
  ]);

  const cancellationsByChave = new Map<string, CancellationRef>();
  for (const event of cancellationEvents) {
    cancellationsByChave.set(event.nfe.chave, {
      id: event.id,
      chave: event.nfe.chave,
      ocorridoEm: event.ocorridoEm,
    });
  }

  return { inutilizations, cancellationsByChave };
}

/**
 * Cadeias fiscais agrupadas por remessa. Cada grupo traz a remessa de origem
 * (com saldo atual) e os cenários que dela derivam.
 */
export async function listTimelineChains(
  db: DbClient,
  tenantId: string,
): Promise<TimelineRemessaGroupDto[]> {
  const [nfes, eventRefs] = await Promise.all([
    db.nFe.findMany({
      where: { tenantId, ...fiscalNotDeleted },
      include: {
        nfeReferencia: { select: { chave: true } },
        itens: { select: { saldoDisponivel: true } },
      },
      orderBy: { emitidaEm: "asc" },
    }),
    loadTimelineEventRefs(db, tenantId),
  ]);

  const byId = new Map<string, ChainNode>(nfes.map((n) => [n.id, n as ChainNode]));
  const byChave = new Map<string, ChainNode>(nfes.map((n) => [n.chave, n as ChainNode]));

  const cenarios = nfes
    .filter((n) => n.tipo === NFeTipo.VENDA)
    .map((v) => {
      const cenario = buildChainFromVenda(v as ChainNode, byId);
      const nfeSteps = cenario.steps.filter((step): step is TimelineNfeStepDto => step.kind === "nfe");
      return {
        ...cenario,
        steps: enrichScenarioStepsWithEvents(
          nfeSteps,
          eventRefs.inutilizations,
          eventRefs.cancellationsByChave,
        ),
      };
    });

  const grupos = new Map<string, TimelineRemessaGroupDto>();

  const getOrCreateGroup = (remessa?: ChainNode): TimelineRemessaGroupDto => {
    const key = remessa?.chave ?? "__avulsa__";
    let g = grupos.get(key);
    if (!g) {
      g = {
        remessaChave: remessa?.chave ?? "",
        remessaNumero: remessa?.numero,
        remessaSerie: remessa?.serie,
        emitidaEm: (remessa?.emitidaEm ?? new Date()).toISOString(),
        quantidadeRemessa: remessa?.quantidade,
        saldoDisponivel: remessa ? saldoFifoNota(remessa) : undefined,
        cenarios: [],
      };
      grupos.set(key, g);
    }
    return g;
  };

  for (const cenario of cenarios) {
    const primeiro = cenario.steps.find((step): step is TimelineNfeStepDto => step.kind === "nfe");
    const remessa =
      primeiro && primeiro.tipo === NFeTipo.REMESSA ? byChave.get(primeiro.chave) : undefined;
    getOrCreateGroup(remessa).cenarios.push(cenario);
  }

  for (const n of nfes) {
    if (n.tipo !== NFeTipo.REMESSA) continue;
    if (grupos.has(n.chave)) continue;
    getOrCreateGroup(n as ChainNode);
  }

  const lista = [...grupos.values()];
  for (const g of lista) {
    g.cenarios.sort((a, b) => new Date(a.emitidaEm).getTime() - new Date(b.emitidaEm).getTime());
  }
  lista.sort((a, b) => {
    if (!a.remessaChave) return 1;
    if (!b.remessaChave) return -1;
    return new Date(a.emitidaEm).getTime() - new Date(b.emitidaEm).getTime();
  });

  return lista;
}
