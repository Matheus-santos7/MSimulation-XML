"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { RemessaManualState } from "@/app/(app)/operacoes/actions";
import { emitirRemessaManualAction } from "@/app/(app)/operacoes/actions";
import { Button } from "@/components/ui/button";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { ProductDto } from "@/lib/fiscal-types";

type Props = {
  products: ProductDto[];
  unidades: UnidadeLogisticaDto[];
};

type LinhaProduto = {
  id: string;
  quantidade: number;
};

function novaLinha(): LinhaProduto {
  return { id: crypto.randomUUID(), quantidade: 1 };
}

export function RemessaManualForm({ products, unidades }: Props) {
  const [state, action, pending] = useActionState<RemessaManualState, FormData>(
    emitirRemessaManualAction,
    {},
  );
  const [linhas, setLinhas] = useState<LinhaProduto[]>(() => [novaLinha()]);

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

  function adicionarLinha() {
    setLinhas((prev) => [...prev, novaLinha()]);
  }

  function removerLinha(id: string) {
    setLinhas((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  }

  function atualizarQuantidade(id: string, quantidade: number) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, quantidade } : l)));
  }

  return (
    <form action={action} className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">
        Remessa física para CD
      </div>
      <p className="text-sm text-muted-foreground">
        Emite uma NF-e de remessa física (CFOP 5949 na mesma UF ou 6949 interestadual) e um CT-e de
        transporte para o CD selecionado, sem
        alterar o cadastro de estoque. Adicione quantos produtos precisar — todos entram na mesma nota.
      </p>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Produtos na remessa</span>
          <Button type="button" variant="outline" size="sm" onClick={adicionarLinha} disabled={pending}>
            + Adicionar produto
          </Button>
        </div>

        <div className="space-y-2">
          {linhas.map((linha, index) => (
            <div
              key={linha.id}
              className="grid gap-2 rounded-md border border-border/60 bg-background/50 p-3 sm:grid-cols-[1fr_7rem_auto]"
            >
              <label className="block space-y-1 min-w-0">
                <span className="text-xs text-muted-foreground">Produto {index + 1}</span>
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

              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Quantidade</span>
                <input
                  type="number"
                  name="quantidade"
                  min={1}
                  value={linha.quantidade}
                  onChange={(e) => atualizarQuantidade(linha.id, Number(e.target.value))}
                  required
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>

              <div className="flex items-end sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removerLinha(linha.id)}
                  disabled={pending || linhas.length <= 1}
                  className="text-muted-foreground"
                >
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

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
        {pending ? "Emitindo…" : linhas.length > 1 ? `Emitir remessa (${linhas.length} produtos)` : "Emitir remessa"}
      </Button>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-success">
          Remessa emitida
          {state.totalItens && state.totalItens > 1 ? ` com ${state.totalItens} produtos` : ""}. NF-e …
          {state.chaveNfe?.slice(-8)} · CT-e …{state.chaveCte?.slice(-8)}.{" "}
          <Link href="/nfe" className="underline">
            Ver NF-e
          </Link>
        </p>
      )}
    </form>
  );
}
