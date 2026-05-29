import type { FiscalStatus } from "@/lib/fiscal-types";

export function StatusBadge({ status }: { status: FiscalStatus }) {
  const styles: Record<FiscalStatus, string> = {
    AUTORIZADA: "bg-success/10 text-success ring-success/25",
    PENDENTE: "bg-accent/10 text-accent ring-accent/25",
    REJEITADA: "bg-destructive/10 text-destructive ring-destructive/25",
    CANCELADA: "bg-red-500/15 text-red-400 ring-red-500/35",
    DENEGADA: "bg-destructive/10 text-destructive ring-destructive/25",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function InutilizadaStatusBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ring-1 ring-inset bg-blue-500/15 text-blue-400 ring-blue-500/35">
      INUTILIZADA
    </span>
  );
}

export function KPI({
  label,
  value,
  hint,
  hintTone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "success" | "accent" | "muted" | "destructive";
}) {
  const tones = {
    success: "text-success",
    accent: "text-accent",
    muted: "text-muted-foreground",
    destructive: "text-destructive",
  } as const;
  return (
    <div className="p-4 border border-border rounded-lg bg-card animate-slide-in">
      <div className="text-muted-foreground text-[13px] font-medium uppercase tracking-wider">
        {label}
      </div>
      <div className="text-3xl font-bold mt-1 tracking-tight">{value}</div>
      {hint && (
        <div className={`text-[12px] font-bold mt-2 ${tones[hintTone]}`}>{hint}</div>
      )}
    </div>
  );
}

export function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
      <h3 className="font-bold text-[13px] uppercase tracking-wider text-foreground">
        {title}
      </h3>
      {right}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-[14px] text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {actions}
    </div>
  );
}
