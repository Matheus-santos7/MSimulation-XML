import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PEDIDO_WIZARD_SELECT_CLASS } from "./pedido-wizard-styles";

export function WizardSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-[13px] text-muted-foreground leading-snug">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function WizardField({
  label,
  value,
  onChange,
  mono,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("bg-background", mono && "font-mono")}
      />
      {hint ? <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p> : null}
    </div>
  );
}

export function WizardSelect({
  label,
  id,
  value,
  onChange,
  children,
  hint,
}: {
  label: string;
  id?: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[12px] text-muted-foreground">
        {label}
      </Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={PEDIDO_WIZARD_SELECT_CLASS}>
        {children}
      </select>
      {hint ? <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p> : null}
    </div>
  );
}

export function WizardReviewCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-3">
        {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</h4>
      </div>
      <div className="flex flex-1 flex-col gap-3 text-[13px]">{children}</div>
    </div>
  );
}

export function WizardReviewRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-[13px] leading-snug text-foreground break-words", mono && "font-mono tabular-nums")}>
        {value}
      </p>
    </div>
  );
}

type WizardReviewOrderItemProps = {
  index: number;
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
};

/** Bloco compacto de um item na etapa de revisão. */
export function WizardReviewOrderItem({
  index,
  sku,
  name,
  qty,
  unitPrice,
  discount,
  lineTotal,
}: WizardReviewOrderItemProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5 space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Item {index}</p>
      <p className="text-[13px] font-medium leading-snug line-clamp-2" title={`${sku} — ${name}`}>
        <span className="font-mono text-[12px] text-muted-foreground">{sku}</span>
        <span className="text-muted-foreground"> · </span>
        {name}
      </p>
      <p className="font-mono text-[12px] tabular-nums text-muted-foreground">
        {qty} × {brl(unitPrice)}
        {discount > 0 ? ` − ${brl(discount)}` : ""}
        {" = "}
        <span className="font-semibold text-foreground">{brl(lineTotal)}</span>
      </p>
    </div>
  );
}

/** Agrupa linhas de resumo (ex.: fretes) com separador visual. */
export function WizardReviewSummary({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto space-y-2.5 border-t border-border/60 pt-3">
      {children}
    </div>
  );
}
