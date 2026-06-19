import Link from "next/link";
import type { TimelineChainDto, TimelineRemessaGroupDto } from "@/lib/fiscal-types";

const TIPO_STYLE: Record<string, string> = {
  REMESSA: "text-amber-500",
  RETORNO_SIMBOLICO: "text-sky-400",
  VENDA: "text-emerald-400",
  DEVOLUCAO: "text-violet-400",
  REMESSA_SIMBOLICA: "text-orange-400",
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
        cenario.status === "completa"
          ? "text-[10px] uppercase font-bold text-success whitespace-nowrap"
          : "text-[10px] uppercase font-bold text-amber-500 whitespace-nowrap"
      }
    >
      {cenario.status === "completa" ? "Completa" : "Em aberto"}
    </span>
  );

  const stepsEl = (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
      {cenario.steps.map((step, i) => (
        <div key={step.chave} className="flex items-center gap-1">
          <Link
            href={`/nfe/${step.chave}`}
            className="group flex flex-col rounded border border-border px-2 py-1 hover:border-accent transition-colors"
          >
            <span className={`text-[10px] font-bold uppercase leading-tight ${TIPO_STYLE[step.tipo] ?? ""}`}>
              {step.tipoLabel}
            </span>
            <span className="font-mono text-[10px] text-foreground group-hover:text-accent">
              {step.numero}/{step.serie}
            </span>
          </Link>
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
