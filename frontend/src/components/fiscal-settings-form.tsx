"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { salvarConfiguracoesFiscaisAction } from "@/app/(app)/configuracoes-fiscais/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FiscalEmitterSettingsPatch } from "@/lib/fiscal-emitter-settings-types";

type Props = {
  title: string;
  backHref?: string;
  children: React.ReactNode;
  onSave: () => FiscalEmitterSettingsPatch;
  /** Rotas adicionais para revalidar após salvar (ex.: subpágina atual). */
  revalidatePaths?: string[];
};

export function FiscalSettingsFormShell({
  title,
  backHref = "/configuracoes-fiscais",
  children,
  onSave,
  revalidatePaths = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    startTransition(async () => {
      const res = await salvarConfiguracoesFiscaisAction(onSave(), revalidatePaths);
      if (!res.ok) {
        setError(res.error ?? "Erro ao salvar");
        return;
      }
      setOk(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <Link href={backHref} className="text-[13px] text-muted-foreground hover:text-foreground">
          ← Configurações fiscais
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">{children}</div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ok ? <p className="text-sm text-success">Configuração salva.</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={backHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}

export function ModeToggle({
  value,
  onChange,
  id,
}: {
  id: string;
  value: "DEFAULT" | "CUSTOM";
  onChange: (v: "DEFAULT" | "CUSTOM") => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Tipo de configuração</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as "DEFAULT" | "CUSTOM")}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="DEFAULT">Padrão do emissor</option>
        <option value="CUSTOM">Customizada por você</option>
      </select>
    </div>
  );
}
