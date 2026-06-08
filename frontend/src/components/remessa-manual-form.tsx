"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { RemessaManualState } from "@/app/(app)/operacoes/actions";
import { emitirRemessaManualAction } from "@/app/(app)/operacoes/actions";
import { Button } from "@/components/ui/button";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { ProductDto } from "@/lib/fiscal-types";

type Props = {
  products: ProductDto[];
  unidades: UnidadeLogisticaDto[];
};

export function RemessaManualForm({ products, unidades }: Props) {
  const [state, action, pending] = useActionState<RemessaManualState, FormData>(
    emitirRemessaManualAction,
    {},
  );

  const padraoId = unidades.find((u) => u.padrao)?.id ?? "";

  if (unidades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Cadastre unidades em{" "}
        <Link href="/unidades-logisticas" className="text-accent underline">
          Unidades ML
        </Link>{" "}
        antes de emitir remessa.
      </p>
    );
  }

  return (
    <form action={action} className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">
        Remessa física para CD (CFOP 6949)
      </div>
      <p className="text-sm text-muted-foreground">
        Emite NF-e de remessa física (CFOP 6949) e CT-e de transporte para o CD selecionado, sem alterar o
        cadastro de estoque do produto.
      </p>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Produto</span>
        <select
          name="productId"
          required
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Selecione…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.nome}
              {p.estoque > 0 ? ` (cadastro: ${p.estoque} un.)` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1 max-w-[8rem]">
        <span className="text-xs text-muted-foreground">Quantidade na NF-e</span>
        <input
          type="number"
          name="quantidade"
          min={1}
          defaultValue={1}
          required
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">CD destino (unidade logística)</span>
        <select
          name="unidadeDestinoId"
          required
          defaultValue={padraoId}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="" disabled={Boolean(padraoId)}>
            Selecione…
          </option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.codigo} — {u.nome} ({u.endereco.uf}){u.padrao ? " · padrão da empresa" : ""}
            </option>
          ))}
        </select>
        {!padraoId && (
          <p className="text-xs text-muted-foreground">
            Defina o CD padrão em{" "}
            <Link href="/unidades-logisticas" className="text-accent underline">
              Unidades ML
            </Link>
            .
          </p>
        )}
      </label>

      <Button type="submit" disabled={pending || products.length === 0}>
        {pending ? "Emitindo…" : "Emitir remessa"}
      </Button>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-success">
          Remessa emitida. NF-e …{state.chaveNfe?.slice(-8)} · CT-e …{state.chaveCte?.slice(-8)}.{" "}
          <Link href="/nfe" className="underline">
            Ver NF-e
          </Link>
        </p>
      )}
    </form>
  );
}
