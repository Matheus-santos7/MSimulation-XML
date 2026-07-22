import { cn } from "@/lib/utils";

/** Classes do link de navegação do AppShell (direção SaaS: ar, rounded, ativo suave). */
export function shellNavLinkClass(active: boolean): string {
  return cn(
    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
    active
      ? "bg-accent/10 text-accent font-medium"
      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
  );
}

/** Rótulo de seção da sidebar (Operacional / Configuração). */
export function shellNavSectionLabelClass(): string {
  return "px-3 pt-5 pb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider";
}

/** Superfície do card de autenticação (login e subrotas). */
export function authSurfaceClass(): string {
  return cn(
    "rounded-2xl border border-border/80 bg-card",
    "p-8 sm:p-10 space-y-6",
    "shadow-[0_24px_48px_-20px_oklch(0.22_0.02_285_/_0.18)]",
  );
}
