import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { ValidationInsightsDto } from "@/lib/fiscal-api/validation-insights";

type Props = {
  data: ValidationInsightsDto;
};

/** Painel de insights de validação MCP (dados do backend). */
export function FiscalValidationInsights({ data }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CheckCircle2} label="Aprovados" value={data.counts.approved} tone="success" />
        <StatCard icon={AlertTriangle} label="Rejeitados" value={data.counts.rejected} tone="accent" />
        <StatCard icon={Clock} label="Pendentes" value={data.counts.pending} tone="muted" />
      </div>

      {data.topErrors.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Erros mais frequentes
          </h2>
          {data.topErrors.map((item) => (
            <div key={item.message} className="border border-border rounded-lg p-4 bg-card">
              <div className="font-medium">{item.message}</div>
              <div className="text-sm text-muted-foreground mt-1">{item.count} ocorrência(s)</div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          NF-e rejeitadas recentemente
        </h2>
        {data.recentRejections.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma rejeição nos últimos {data.periodDays} dias.
          </p>
        ) : (
          data.recentRejections.map((row) => (
            <div
              key={row.chave}
              className="border border-destructive/30 bg-destructive/5 rounded-lg p-4 flex gap-4"
            >
              <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-bold">
                  NF-e {row.numero}/{row.serie} · CFOP {row.cfop}
                </div>
                <div className="text-sm text-muted-foreground mt-1 truncate">{row.message}</div>
                {row.errors[0] && (
                  <div className="text-xs text-destructive/90 mt-2">{row.errors[0]}</div>
                )}
              </div>
              <Link
                href={`/nfe/${row.chave}`}
                className="text-xs font-bold uppercase tracking-widest text-accent hover:underline self-start shrink-0"
              >
                Ver NF-e →
              </Link>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: "success" | "accent" | "muted";
}) {
  const tones = {
    success: "border-success/30 bg-success/5",
    accent: "border-accent/30 bg-accent/5",
    muted: "border-border bg-card",
  };
  return (
    <div className={`border rounded-lg p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}
