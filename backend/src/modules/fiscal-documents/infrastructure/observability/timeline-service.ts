import { FiscalStatus, NFeTipo } from "../../../../generated/prisma/client.js";
import type { DbClient } from "../../../../lib/db/prisma-tx.js";
import { labelNfeTipo } from "../../presentation/mappers/fiscal-mappers.js";
import { fiscalNotDeleted } from "../../domain/constants/fiscal-not-deleted.js";
import {
  enrichScenarioStepsWithEvents,
  type CancellationRef,
  type InutilizationRef,
} from "./timeline-chain-enrichment.js";
import { insertCteStepsIntoChain, type TimelineCteRef } from "./timeline-cte-insertion.js";
import type {
  TimelineChainDto,
  TimelineNfeStepDto,
  TimelineRemessaGroupDto,
} from "./timeline-step.dto.js";

// Reexporta os DTOs para quem consome este serviço não precisar importar o arquivo de tipos.
export type {
  TimelineChainDto,
  TimelineChainStepDto,
  TimelineCteStepDto,
  TimelineEventStepDto,
  TimelineNfeStepDto,
  TimelineRemessaGroupDto,
} from "./timeline-step.dto.js";

/**
 * Forma mínima de uma NF-e usada só aqui.
 * Não é o model inteiro do Prisma: só os campos que a timeline lê.
 *
 * `nfeReferenciaId` é o elo da cadeia. Ex.: o retorno simbólico aponta
 * para a remessa; a venda aponta para o retorno. Subindo esse id a gente
 * reconstrói remessa → retorno → venda.
 */
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

/**
 * Quanto ainda resta da remessa que entrou no depósito (saldo FIFO).
 *
 * FIFO = first in, first out: a mercadoria que entrou primeiro é a que
 * sai primeiro. Esse saldo só faz sentido na REMESSA (e na remessa de
 * avanço), porque é ela que coloca estoque no operador logístico
 * (Portaria CAT 31/2019, art. 5º). Venda e retorno simbólico consomem
 * esse estoque; por isso devolvemos `undefined` nos outros tipos.
 */
function saldoFifoNota(nfe: ChainNode): number | undefined {
  if (nfe.tipo !== NFeTipo.REMESSA && nfe.tipo !== NFeTipo.REMESSA_AVANCO) {
    return undefined;
  }
  // O saldo real está em cada item. Somamos os itens já carregados.
  if (nfe.itens && nfe.itens.length > 0) {
    return nfe.itens.reduce((acc, item) => acc + (item.saldoDisponivel ?? 0), 0);
  }
  // Sem itens na query, usamos o saldo gravado na própria nota (0 se vier null).
  return nfe.saldoDisponivel ?? 0;
}

/**
 * Converte o registro do banco no passo que a API devolve.
 * `kind: "nfe"` distingue este passo de evento (cancelamento/inutilização) e de CT-e.
 * A data vira ISO string porque o DTO atravessa JSON e não carrega objeto Date.
 */
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
    // Chave da nota pai (a que esta NF-e referencia), quando existir.
    nfeReferenciaChave: nfe.nfeReferencia?.chave,
  };
}

/**
 * Resume o cenário em uma palavra para a tela.
 *
 * - cancelada: a venda foi cancelada. Isso vale mais do que o restante da cadeia.
 * - completa: tem venda E retorno simbólico. É o par obrigatório da CAT 31
 *   (art. 7º): a venda fatura o cliente e o retorno dá baixa no estoque do CD.
 * - parcial: tem venda, mas ainda falta o retorno (cadeia incompleta).
 */
function resolveScenarioStatus(steps: TimelineNfeStepDto[]): TimelineChainDto["status"] {
  const venda = steps.find((s) => s.tipo === NFeTipo.VENDA);
  const retorno = steps.find((s) => s.tipo === NFeTipo.RETORNO_SIMBOLICO);

  if (venda?.status === FiscalStatus.CANCELADA) return "cancelada";
  if (venda && retorno) return "completa";
  return "parcial";
}

/**
 * Monta UM cenário a partir de uma venda.
 *
 * O banco guarda o vínculo "de baixo para cima" (`nfeReferenciaId`):
 * a venda aponta para o retorno, o retorno aponta para a remessa.
 * O `while` sobe essa escada. O `unshift` coloca cada nota no COMEÇO
 * do array, então a ordem final fica a da operação:
 * remessa → retorno simbólico → venda.
 *
 * Devolução e remessa simbólica não estão nessa escada da venda.
 * Elas apontam para a frente (devolução → venda, remessa simbólica → devolução),
 * então são procuradas à parte e anexadas no fim.
 */
function buildChainFromVenda(venda: ChainNode, byId: Map<string, ChainNode>): TimelineChainDto {
  const nfeSteps: TimelineNfeStepDto[] = [];
  // Começa na própria venda. `byId` evita ir ao banco de novo.
  let cur: ChainNode | undefined = byId.get(venda.id);

  while (cur) {
    // unshift = insere na posição 0. A nota mais antiga (remessa) acaba na frente.
    nfeSteps.unshift(mapStep(cur));
    // Sobe para a nota referenciada. Para quando não há pai (fim da cadeia).
    cur = cur.nfeReferenciaId ? byId.get(cur.nfeReferenciaId) : undefined;
  }

  const todos = [...byId.values()];
  // Devolução de cliente: o campo de referência guarda o id da venda.
  const devolucoes = todos.filter(
    (n) => n.tipo === NFeTipo.DEVOLUCAO && n.nfeReferenciaId === venda.id,
  );
  for (const dev of devolucoes) {
    nfeSteps.push(mapStep(dev));
    // Remessa simbólica devolve o item ao fluxo do fulfillment e aponta para a devolução.
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
    // Neste momento `steps` só tem NF-e. Eventos e CT-e entram depois.
    steps: nfeSteps,
  };
}

/**
 * Busca os eventos que a timeline desenha junto das notas.
 *
 * - Inutilização: a SEFAZ queimou uma faixa de números que não virou NF-e.
 * - 110111: código oficial do evento de cancelamento de NF-e.
 *   Guardamos num Map pela chave de 44 dígitos para achar o cancelamento
 *   em O(1) quando estivermos montando cada cenário.
 */
async function loadTimelineEventRefs(
  db: DbClient,
  tenantId: string,
): Promise<{
  inutilizations: InutilizationRef[];
  cancellationsByChave: Map<string, CancellationRef>;
}> {
  // As duas queries não dependem uma da outra: rodam juntas.
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
    // Se houver mais de um 110111 na mesma chave, o último da lista fica.
    cancellationsByChave.set(event.nfe.chave, {
      id: event.id,
      chave: event.nfe.chave,
      ocorridoEm: event.ocorridoEm,
    });
  }

  return { inutilizations, cancellationsByChave };
}

/**
 * CT-e do tenant que ainda não foi apagado.
 * `nfeRemessaId` / `nfeVendaId` dizem depois de qual NF-e o frete aparece na timeline.
 */
async function loadTimelineCtes(db: DbClient, tenantId: string): Promise<TimelineCteRef[]> {
  const rows = await db.cTe.findMany({
    where: { tenantId, deletedAt: null },
    select: {
      id: true,
      chave: true,
      numero: true,
      serie: true,
      emitidoEm: true,
      status: true,
      nfeRemessaId: true,
      nfeVendaId: true,
    },
  });
  return rows;
}

/**
 * Ponto de entrada da timeline.
 *
 * Devolve grupos. Cada grupo é uma remessa de estoque para o fulfillment
 * e a lista de cenários (vendas) que consumiram essa remessa.
 * Uma remessa de 4 unidades pode ter vários cenários; o saldo do grupo
 * mostra o que ainda não foi vendido.
 *
 * Passos:
 * 1. Carrega NF-e, eventos e CT-e do tenant.
 * 2. Para cada VENDA, sobe a cadeia e encaixa eventos e CT-e.
 * 3. Agrupa os cenários pela remessa que está na frente da cadeia.
 * 4. Inclui remessa que ainda não teve venda.
 * 5. Ordena por data. O grupo sem remessa (venda avulsa) fica por último.
 */
export async function listTimelineChains(
  db: DbClient,
  tenantId: string,
): Promise<TimelineRemessaGroupDto[]> {
  // Promise.all espera as três leituras. Nenhuma usa o resultado da outra.
  const [nfes, eventRefs, ctes] = await Promise.all([
    db.nFe.findMany({
      where: { tenantId, ...fiscalNotDeleted },
      include: {
        // Só a chave da nota pai: é o que o card da timeline mostra como referência.
        nfeReferencia: { select: { chave: true } },
        itens: { select: { saldoDisponivel: true } },
      },
      orderBy: { emitidaEm: "asc" },
    }),
    loadTimelineEventRefs(db, tenantId),
    loadTimelineCtes(db, tenantId),
  ]);

  // Três índices em memória para não varrer o array inteiro a cada busca.
  const byId = new Map<string, ChainNode>(nfes.map((n) => [n.id, n as ChainNode]));
  const byChave = new Map<string, ChainNode>(nfes.map((n) => [n.chave, n as ChainNode]));
  // O CT-e guarda o id da NF-e; o passo da timeline só tem a chave. Este mapa liga os dois.
  const nfeChaveToId = new Map(nfes.map((n) => [n.chave, n.id]));

  // Um cenário por venda. Remessa sozinha não gera cenário (entra no passo 4).
  const cenarios = nfes
    .filter((n) => n.tipo === NFeTipo.VENDA)
    .map((v) => {
      const cenario = buildChainFromVenda(v as ChainNode, byId);
      // O filtro com `step is TimelineNfeStepDto` é um type guard: aqui todos
      // os passos ainda são NF-e, mas o tipo do array já admite evento e CT-e.
      const nfeSteps = cenario.steps.filter((step): step is TimelineNfeStepDto => step.kind === "nfe");
      // Insere inutilização e cancelamento entre as notas, ordenados pelo número.
      const withEvents = enrichScenarioStepsWithEvents(
        nfeSteps,
        eventRefs.inutilizations,
        eventRefs.cancellationsByChave,
      );
      return {
        ...cenario,
        // CT-e fica imediatamente depois da remessa e/ou da venda vinculada.
        steps: insertCteStepsIntoChain(withEvents, ctes, nfeChaveToId),
      };
    });

  // Chave do Map = chave de acesso da remessa. Vários cenários caem no mesmo grupo.
  const grupos = new Map<string, TimelineRemessaGroupDto>();

  /**
   * Cria o grupo na primeira vez que vemos aquela remessa e devolve o mesmo
   * objeto nas vezes seguintes, para dar `push` em `cenarios`.
   * Sem remessa, todos os cenários avulsos compartilham a chave "__avulsa__".
   */
  const getOrCreateGroup = (remessa?: ChainNode): TimelineRemessaGroupDto => {
    // "__avulsa__" é só chave interna. A API manda `remessaChave: ""`.
    const key = remessa?.chave ?? "__avulsa__";
    let g = grupos.get(key);
    if (!g) {
      g = {
        remessaChave: remessa?.chave ?? "",
        remessaNumero: remessa?.numero,
        remessaSerie: remessa?.serie,
        // Grupo avulso não tem data de remessa: usamos "agora" só para ordenar.
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
    // O primeiro passo que é NF-e deve ser a remessa, se a cadeia estiver completa.
    // Eventos e CT-e podem ter sido inseridos antes; por isso não usamos steps[0].
    const primeiro = cenario.steps.find((step): step is TimelineNfeStepDto => step.kind === "nfe");
    const remessa =
      primeiro && primeiro.tipo === NFeTipo.REMESSA ? byChave.get(primeiro.chave) : undefined;
    // `remessa` undefined (checkout sem remessa) cai no grupo avulso.
    getOrCreateGroup(remessa).cenarios.push(cenario);
  }

  // Remessa que ainda não originou venda não apareceu no laço acima.
  // Criamos o grupo vazio para o saldo continuar visível na tela.
  for (const n of nfes) {
    if (n.tipo !== NFeTipo.REMESSA) continue;
    if (grupos.has(n.chave)) continue;
    getOrCreateGroup(n as ChainNode);
  }

  const lista = [...grupos.values()];
  // Dentro de cada remessa, cenários mais antigos primeiro.
  for (const g of lista) {
    g.cenarios.sort((a, b) => new Date(a.emitidaEm).getTime() - new Date(b.emitidaEm).getTime());
  }
  lista.sort((a, b) => {
    // Grupo avulso (`remessaChave` vazio) sempre por último, dos dois lados da comparação.
    if (!a.remessaChave) return 1;
    if (!b.remessaChave) return -1;
    return new Date(a.emitidaEm).getTime() - new Date(b.emitidaEm).getTime();
  });

  return lista;
}
