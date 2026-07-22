import { cn } from "@/lib/utils";

/** Classes do link de navegação do AppShell (densidade média para MacBook). */
export function shellNavLinkClass(active: boolean): string {
  return cn(
    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm leading-snug transition-colors",
    active
      ? "bg-accent/10 text-accent font-medium"
      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
  );
}

/** Rótulo de seção da sidebar (Operacional / Configuração). */
export function shellNavSectionLabelClass(): string {
  return "px-3 pt-3.5 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider";
}

/** Superfície do card de autenticação (login e subrotas). */
export function authSurfaceClass(): string {
  return cn(
    "rounded-2xl border border-border bg-card",
    "p-8 sm:p-10 space-y-6",
    "shadow-[0_24px_48px_-20px_oklch(0.22_0.02_285_/_0.18)]",
    "dark:shadow-[0_24px_48px_-16px_oklch(0_0_0_/_0.55)] dark:border-border",
  );
}

/** Painel de conteúdo (dashboard e seções internas — SaaS). */
export function panelSurfaceClass(): string {
  return cn(
    "rounded-2xl border border-border bg-card",
    "overflow-hidden",
    "shadow-[0_12px_32px_-18px_oklch(0.22_0.02_285_/_0.12)]",
    "dark:shadow-[0_16px_40px_-20px_oklch(0_0_0_/_0.5)] dark:ring-1 dark:ring-white/[0.04]",
  );
}

/** Cabeçalho de seção dentro de um painel. */
export function panelHeaderClass(): string {
  return "px-4 py-3 border-b border-border/70 flex items-center justify-between gap-3 shrink-0";
}
