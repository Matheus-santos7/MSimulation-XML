"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { salvarConfiguracoesFiscaisAction } from "@/app/(app)/configuracoes-fiscais/actions";
import { Button } from "@/components/ui/button";
import type { FiscalEmitterSettingsPatch } from "@/lib/fiscal-emitter-settings-types";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  breadcrumb?: string;
  children: ReactNode;
  onSave: () => FiscalEmitterSettingsPatch;
  wide?: boolean;
};

export function FiscalSettingsScreenLayout({
  title,
  description,
  breadcrumb,
  children,
  onSave,
  wide,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await salvarConfiguracoesFiscaisAction(onSave());
      if (!res.ok) {
        setError(res.error ?? "Erro ao salvar");
        return;
      }
      router.refresh();
      router.push("/configuracoes-fiscais");
    });
  }

  return (
    <div className={cn("mx-auto space-y-6 p-6 pb-24", wide ? "max-w-4xl" : "max-w-2xl")}>
      <nav className="text-[13px] text-muted-foreground">
        <Link href="/configuracoes-fiscais" className="hover:text-foreground">
          Configurações fiscais
        </Link>
        {breadcrumb ? (
          <>
            <span className="mx-1.5">›</span>
            <span className="text-foreground/80">{breadcrumb}</span>
          </>
        ) : null}
      </nav>

      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      </header>

      {children}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:left-[var(--sidebar-width,0)]">
        <div className={cn("mx-auto flex justify-end gap-3", wide ? "max-w-4xl" : "max-w-2xl")}>
          <Button type="button" variant="ghost" asChild disabled={pending}>
            <Link href="/configuracoes-fiscais">Cancelar</Link>
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FiscalInfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm leading-relaxed text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
        i
      </span>
      <div>{children}</div>
    </div>
  );
}

export function FiscalSettingsCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>{children}</div>
  );
}
