"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateTenantPapeisAction } from "@/app/(app)/empresas/actions";
import type { TenantDto } from "@/lib/fiscal-types";

export function EmitentePapeisTenantForm({ tenant }: { tenant: TenantDto }) {
  const router = useRouter();
  const [principal, setPrincipal] = useState(tenant.emitenteFiscalPrincipal ?? true);
  const [matriz, setMatriz] = useState(tenant.emitenteFiscalMatriz ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar() {
    setPending(true);
    setError(null);
    setOk(false);
    try {
      const result = await updateTenantPapeisAction(tenant.id, {
        emitenteFiscalPrincipal: principal,
        emitenteFiscalMatriz: matriz,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOk(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar papéis");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 max-w-xl">
      <h2 className="text-sm font-medium">Papéis fiscais do cadastro principal</h2>
      <p className="text-sm text-muted-foreground">
        Use estes flags quando a matriz (CNPJ {tenant.cnpj}) participa da operação. Se a loja principal
        for uma filial, desmarque aqui e marque os papéis na filial correspondente.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={principal}
          onChange={(e) => setPrincipal(e.target.checked)}
        />
        Emitente fiscal principal — emite remessas, vendas e demais NF-e operacionais
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={matriz} onChange={(e) => setMatriz(e.target.checked)} />
        Emitente fiscal matriz — emite apenas transferência interna para filial
      </label>
      <Button type="button" onClick={salvar} disabled={pending}>
        {pending ? "Salvando…" : "Salvar papéis"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {ok && <p className="text-sm text-success">Papéis atualizados.</p>}
    </div>
  );
}
