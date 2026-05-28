import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  hint?: string;
  href?: string;
  disabled?: boolean;
  children?: React.ReactNode;
};

export function FiscalSettingsRow({ label, hint, href, disabled, children }: Props) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium text-foreground">{label}</div>
        {hint ? <div className="mt-0.5 text-[13px] text-muted-foreground">{hint}</div> : null}
      </div>
      {children ?? (href && !disabled ? <ChevronRight className="size-5 shrink-0 text-muted-foreground" /> : null)}
    </>
  );

  const className = cn(
    "flex items-center gap-4 px-4 py-3.5 transition-colors",
    href && !disabled && "hover:bg-muted/40 cursor-pointer",
    disabled && "opacity-60",
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function FiscalSettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <h2 className="border-b border-border bg-muted/20 px-4 py-3 text-[15px] font-semibold text-foreground">
        {title}
      </h2>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}
