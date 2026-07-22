import type { FiscalStatus } from "@/lib/fiscal-types";
import { panelHeaderClass } from "@/lib/ui/shell-styles";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: FiscalStatus }) {
  const styles: Record<FiscalStatus, string> = {
    AUTORIZADA: "bg-success/15 text-success ring-success/25",
    PENDENTE: "bg-accent/15 text-accent ring-accent/25",
    REJEITADA: "bg-destructive/15 text-destructive ring-destructive/25",
    CANCELADA: "bg-muted text-muted-foreground ring-border",
    DENEGADA: "bg-destructive/15 text-destructive ring-destructive/25",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function InutilizadaStatusBadge() {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium uppercase tracking-wide ring-1 ring-inset bg-muted text-muted-foreground ring-border">
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
    <div className={panelHeaderClass()}>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {right}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between mb-6", className)}>
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
