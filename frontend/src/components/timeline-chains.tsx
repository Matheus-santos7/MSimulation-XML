import Link from "next/link";
import type {
  TimelineChainDto,
  TimelineChainStepDto,
  TimelineEventStepDto,
  TimelineRemessaGroupDto,
} from "@/lib/fiscal-types";
import { fiscalEventXmlHref } from "@/lib/fiscal-xml-routes";

const TIPO_STYLE: Record<string, string> = {
  REMESSA: "text-amber-500",
  RETORNO_SIMBOLICO: "text-sky-400",
  VENDA: "text-emerald-400",
  DEVOLUCAO: "text-violet-400",
  REMESSA_SIMBOLICA: "text-orange-400",
  REMESSA_AVANCO: "text-orange-300",
};

const EVENT_STYLE: Record<TimelineEventStepDto["eventTipo"], string> = {
  INUT: "text-blue-400 border-blue-500/30 bg-blue-500/5",
  "110111": "text-red-400 border-red-500/30 bg-red-500/5",
};

type TimelineChainsProps = {
  groups: TimelineRemessaGroupDto[];
  /** `rows` exibe cenários em linhas horizontais que ocupam a largura (ideal para o dashboard). */
  layout?: "vertical" | "rows";
};

export function TimelineChains({ groups, layout = "vertical" }: TimelineChainsProps) {
  if (groups.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground p-4">
        Nenhuma cenário fiscal ainda. Emita remessas e fature pedidos para formar Remessa → Retorno → Venda.
      </p>
    );
  }

  if (layout === "rows") {
    return (
      <div className="p-4 space-y-4 max-h-[280px] overflow-y-auto">
        {groups.map((group) => (
          <RemessaGroup key={group.remessaChave || "avulsa"} group={group} variant="rows" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-h-[560px] overflow-y-auto">
      {groups.map((group) => (
        <RemessaGroup key={group.remessaChave || "avulsa"} group={group} />
      ))}
    </div>
  );
}

function RemessaGroup({
  group,
  variant = "stacked",
}: {
  group: TimelineRemessaGroupDto;
  variant?: "stacked" | "rows";
}) {
  const avulsa = !group.remessaChave;
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-amber-500/5 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-widest text-amber-500">
            {avulsa ? "Vendas avulsas" : `Remessa ${group.remessaNumero}/${group.remessaSerie}`}
          </div>
          {!avulsa && (
            <div className="text-[11px] text-muted-foreground font-mono">
              {group.quantidadeRemessa} und enviadas
              {group.saldoDisponivel != null && (
                <>
                  {" · "}
                  <span className={group.saldoDisponivel > 0 ? "text-amber-500" : "text-muted-foreground"}>
                    saldo {group.saldoDisponivel}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <span className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">
          {group.cenarios.length} {group.cenarios.length === 1 ? "cenário" : "cenários"}
        </span>
      </div>

      {group.cenarios.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          Saldo disponível no full — ainda sem venda associada.
        </p>
      ) : variant === "rows" ? (
        <div className="divide-y divide-border">
          {group.cenarios.map((cenario, i) => (
            <ScenarioRow key={cenario.id} cenario={cenario} index={i + 1} variant="inline" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {group.cenarios.map((cenario, i) => (
            <ScenarioRow key={cenario.id} cenario={cenario} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function formatEventNumero(step: TimelineEventStepDto): string {
  if (step.numeroFim != null && step.numeroFim !== step.numero) {
    return `${step.numero}–${step.numeroFim}/${step.serie}`;
  }
  return `${step.numero}/${step.serie}`;
}

function TimelineStepChip({ step }: { step: TimelineChainStepDto }) {
  if (step.kind === "event") {
    const hrefs = fiscalEventXmlHref({
      id: step.eventId,
      tipo: step.eventTipo,
      chaveRef: step.chaveRef,
    });

    const chip = (
      <div
        className={`flex flex-col rounded border px-2 py-1 ${EVENT_STYLE[step.eventTipo]} ${
          hrefs ? "hover:border-accent transition-colors" : ""
        }`}
      >
        <span className="text-[10px] font-bold uppercase leading-tight">{step.eventLabel}</span>
        <span className="font-mono text-[10px]">{formatEventNumero(step)}</span>
      </div>
    );

    if (!hrefs) return chip;

    return (
      <a href={hrefs.viewPath} target="_blank" rel="noopener noreferrer" className="group">
        {chip}
      </a>
    );
  }

  const isCancelled = step.status === "CANCELADA";

  return (
    <Link
      href={`/nfe/${step.chave}`}
      className={`group flex flex-col rounded border px-2 py-1 hover:border-accent transition-colors ${
        isCancelled ? "opacity-60 border-red-500/30 bg-red-500/5" : "border-border"
      }`}
    >
      <span
        className={`text-[10px] font-bold uppercase leading-tight ${TIPO_STYLE[step.tipo] ?? ""} ${
          isCancelled ? "line-through" : ""
        }`}
      >
        {step.tipoLabel}
      </span>
      <span className="font-mono text-[10px] text-foreground group-hover:text-accent">
        {step.numero}/{step.serie}
      </span>
    </Link>
  );
}

function ScenarioRow({
  cenario,
  index,
  variant = "stacked",
}: {
  cenario: TimelineChainDto;
  index: number;
  variant?: "stacked" | "inline";
}) {
  const statusEl = (
    <span
      className={
        cenario.status === "cancelada"
          ? "text-[10px] uppercase font-bold text-red-400 whitespace-nowrap"
          : cenario.status === "completa"
            ? "text-[10px] uppercase font-bold text-success whitespace-nowrap"
            : "text-[10px] uppercase font-bold text-amber-500 whitespace-nowrap"
      }
    >
      {cenario.status === "cancelada"
        ? "Cancelada"
        : cenario.status === "completa"
          ? "Completa"
          : "Em aberto"}
    </span>
  );

  const stepsEl = (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
      {cenario.steps.map((step, i) => (
        <div key={stepKey(step, i)} className="flex items-center gap-1">
          <TimelineStepChip step={step} />
          {i < cenario.steps.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
        </div>
      ))}
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-4 px-3 py-2.5 hover:bg-foreground/[0.02] transition-colors">
        <div className="shrink-0 w-[min(180px,22%)] min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-foreground truncate">
            Cenário {index}
            {cenario.pedidoMl && (
              <span className="ml-1.5 font-normal normal-case text-muted-foreground">{cenario.pedidoMl}</span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">{stepsEl}</div>
        <div className="shrink-0">{statusEl}</div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
          Cenário {index}
          {cenario.pedidoMl && (
            <span className="ml-1.5 font-normal normal-case text-muted-foreground">{cenario.pedidoMl}</span>
          )}
        </span>
        {statusEl}
      </div>
      {stepsEl}
    </div>
  );
}

function stepKey(step: TimelineChainStepDto, index: number): string {
  if (step.kind === "event") return `evt-${step.eventId}-${index}`;
  return step.chave;
}
