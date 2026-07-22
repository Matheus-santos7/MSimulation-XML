import Link from "next/link";
import type {
  TimelineChainDto,
  TimelineChainStepDto,
  TimelineEventStepDto,
  TimelineRemessaGroupDto,
} from "@/lib/fiscal-types";
import { fiscalEventXmlHref } from "@/lib/fiscal-xml-routes";
import {
  flattenScenarioRows,
  type FlatScenarioRow,
} from "@/lib/ui/timeline-rows";
import { cn } from "@/lib/utils";

const CHIP_NEUTRAL =
  "border-border bg-background/60 text-foreground hover:bg-muted/50 dark:bg-background/40";
const CHIP_CANCELLED =
  "border-border/70 bg-muted/40 text-muted-foreground opacity-75";
const CHIP_EVENT = "border-border bg-muted/50 text-muted-foreground";

type TimelineChainsProps = {
  groups: TimelineRemessaGroupDto[];
  /** `rows` exibe cenários em linhas horizontais (dashboard). */
  layout?: "vertical" | "rows";
};

export function TimelineChains({ groups, layout = "vertical" }: TimelineChainsProps) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-4 py-3">
        Nenhum cenário fiscal ainda. Emita remessas e fature pedidos para formar Remessa → Retorno →
        Venda.
      </p>
    );
  }

  if (layout === "rows") {
    const rows = flattenScenarioRows(groups);
    return (
      <div className="h-full max-h-full overflow-y-auto p-3 space-y-2">
        {rows.map((row) => (
          <DashboardScenarioRow key={row.key} row={row} />
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

function DashboardScenarioRow({ row }: { row: FlatScenarioRow }) {
  const { remessaLabel, remessaMeta, cenario, index } = row;
  const steps = cenario?.steps ?? [];

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-background/50 px-3.5 py-2.5 hover:bg-muted/40 transition-colors dark:bg-background/35">
      <div className="shrink-0 w-[148px] min-w-0">
        <div className="text-xs font-semibold text-foreground truncate leading-snug">
          {remessaLabel}
        </div>
        {remessaMeta ? (
          <div className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
            {remessaMeta}
          </div>
        ) : index > 0 ? (
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            Cenário {index}
          </div>
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        {steps.length === 0 ? (
          <span className="text-xs text-muted-foreground">Sem venda associada</span>
        ) : (
          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {steps.map((step, i) => (
              <div key={stepKey(step, i)} className="flex items-center gap-1.5 shrink-0">
                <TimelineStepChip step={step} />
                {i < steps.length - 1 && (
                  <span className="text-muted-foreground/70 text-xs" aria-hidden>
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0">
        {cenario && steps.length > 0 ? <ScenarioStatusBadge status={cenario.status} /> : null}
      </div>
    </div>
  );
}

function RemessaGroup({ group }: { group: TimelineRemessaGroupDto }) {
  const avulsa = !group.remessaChave;
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-tight text-foreground">
            {avulsa ? "Vendas avulsas" : `Remessa ${group.remessaNumero}/${group.remessaSerie}`}
          </div>
          {!avulsa && (
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {group.quantidadeRemessa} und enviadas
              {group.saldoDisponivel != null && (
                <>
                  {" · "}
                  <span
                    className={
                      group.saldoDisponivel > 0 ? "text-accent font-medium" : "text-muted-foreground"
                    }
                  >
                    saldo {group.saldoDisponivel}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {group.cenarios.length} {group.cenarios.length === 1 ? "cenário" : "cenários"}
        </span>
      </div>

      {group.cenarios.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          Saldo disponível no full — ainda sem venda associada.
        </p>
      ) : (
        <div className="divide-y divide-border/50">
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
        className={cn(
          "flex flex-col border transition-colors rounded-lg px-2.5 py-1.5",
          CHIP_EVENT,
          hrefs && "group-hover:border-accent/40",
        )}
      >
        <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide">
          {step.eventLabel}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {formatEventNumero(step)}
        </span>
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
      className={cn(
        "group flex flex-col border transition-colors rounded-lg px-2.5 py-1.5",
        isCancelled ? CHIP_CANCELLED : CHIP_NEUTRAL,
        !isCancelled && "hover:border-accent/40",
      )}
    >
      <span
        className={cn(
          "text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground",
          isCancelled && "line-through",
        )}
      >
        {step.tipoLabel}
      </span>
      <span className="font-mono text-[10px] text-foreground group-hover:text-accent">
        {step.numero}/{step.serie}
      </span>
    </Link>
  );
}

function ScenarioStatusBadge({ status }: { status: TimelineChainDto["status"] }) {
  const label =
    status === "cancelada" ? "Cancelada" : status === "completa" ? "Completa" : "Em aberto";

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium tracking-wide rounded-lg px-2.5 py-1 text-[11px]",
        status === "cancelada" && "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
        status === "completa" && "bg-success/15 text-success ring-1 ring-inset ring-success/25",
        status !== "cancelada" &&
          status !== "completa" &&
          "bg-accent/15 text-accent ring-1 ring-inset ring-accent/25",
      )}
    >
      {label}
    </span>
  );
}

function ScenarioRow({
  cenario,
  index,
}: {
  cenario: TimelineChainDto;
  index: number;
}) {
  const statusEl = <ScenarioStatusBadge status={cenario.status} />;

  const stepsEl = (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
      {cenario.steps.map((step, i) => (
        <div key={stepKey(step, i)} className="flex items-center gap-1.5">
          <TimelineStepChip step={step} />
          {i < cenario.steps.length - 1 && (
            <span className="text-muted-foreground/70 text-xs" aria-hidden>
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          Cenário {index}
          {cenario.pedidoMl && (
            <span className="ml-1.5 font-normal text-muted-foreground">{cenario.pedidoMl}</span>
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
