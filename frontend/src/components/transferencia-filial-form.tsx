"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { TransferenciaFilialState } from "@/app/(app)/operacoes/actions";
import { emitirTransferenciaFilialAction } from "@/app/(app)/operacoes/actions";
import { Button } from "@/components/ui/button";
import type { TenantFilialDto } from "@/lib/fiscal-types";
import type { ProductDto } from "@/lib/fiscal-types";

type Props = {
  products: ProductDto[];
  filiais: TenantFilialDto[];
  emitenteTransferenciaId?: string | null;
};

type LinhaProduto = {
  rowKey: string;
  productId: string;
  quantidade: number;
};

function novaLinha(): LinhaProduto {
  return { rowKey: crypto.randomUUID(), productId: "", quantidade: 1 };
}

export function TransferenciaFilialForm({ products, filiais, emitenteTransferenciaId }: Props) {
  const [state, action, pending] = useActionState<TransferenciaFilialState, FormData>(
    emitirTransferenciaFilialAction,
    {},
  );
  const [linhas, setLinhas] = useState<LinhaProduto[]>(() => [novaLinha()]);
  const filiaisDestino = filiais.filter((f) => f.id !== emitenteTransferenciaId);
  const [filialId, setFilialId] = useState(filiaisDestino[0]?.id ?? "");

  if (filiais.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Cadastre ao menos uma filial em{" "}
        <Link href="/empresas" className="text-accent underline">
          Empresas
        </Link>{" "}
        antes de emitir a transferência.
      </p>
    );
  }

  if (filiaisDestino.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma filial disponível como destino. A emitente matriz não pode receber a transferência — cadastre outra
        filial operacional em{" "}
        <Link href="/empresas" className="text-accent underline">
          Empresas
        </Link>
        .
      </p>
    );
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, novaLinha()]);
  }

  function removerLinha(rowKey: string) {
    setLinhas((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.rowKey !== rowKey)));
  }

  function atualizarProduto(rowKey: string, productId: string) {
    setLinhas((prev) => prev.map((l) => (l.rowKey === rowKey ? { ...l, productId } : l)));
  }

  function atualizarQuantidade(rowKey: string, quantidade: number) {
    setLinhas((prev) => prev.map((l) => (l.rowKey === rowKey ? { ...l, quantidade } : l)));
  }

  const filialSelecionada = filiaisDestino.find((f) => f.id === filialId);

  return (
    <form action={action} className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">
        Transferência matriz → filial + remessa automática ao CD
      </div>
      <p className="text-sm text-muted-foreground">
        A matriz emite NF-e de transferência (CFOP 5152/6152) para a filial selecionada. Em seguida, a filial emite
        remessa física ao CD padrão (ou CD vinculado à filial), usando a série configurada na filial e as regras
        tributárias inbound da planilha por origem e produto.
      </p>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Filial destino</span>
        <select
          name="filialId"
          required
          value={filialId}
          onChange={(e) => setFilialId(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          {filiaisDestino.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nomeFantasia} — {f.cnpj} ({f.uf}) · série remessa {f.serieRemessa}
            </option>
          ))}
        </select>
      </label>

      {filialSelecionada && (
        <p className="text-xs text-muted-foreground">
          Remessa automática: origem {filialSelecionada.uf} → CD{" "}
          {filialSelecionada.unidadeLogisticaPadraoId
            ? "vinculado à filial"
            : "padrão da matriz"}
          . Confirme regra fiscal inbound e preço de custo de cada produto.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Produtos</span>
          <Button type="button" variant="outline" size="sm" onClick={adicionarLinha} disabled={pending}>
            + Adicionar produto
          </Button>
        </div>

        <div className="space-y-2">
          {linhas.map((linha, index) => {
            const skuSelecionado = products.find((p) => p.id === linha.productId)?.sku ?? "";
            return (
              <div
                key={linha.rowKey}
                className="grid gap-2 rounded-md border border-border/60 bg-background/50 p-3 sm:grid-cols-[1fr_7rem_auto]"
              >
                <label className="block space-y-1 min-w-0">
                  <span className="text-xs text-muted-foreground">Produto {index + 1}</span>
                  <select
                    name="productId"
                    required
                    value={linha.productId}
                    onChange={(e) => atualizarProduto(linha.rowKey, e.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">Selecione…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.nome}
                      </option>
                    ))}
                  </select>
                  <input type="hidden" name="productSku" value={skuSelecionado} />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">Quantidade</span>
                  <input
                    type="number"
                    name="quantidade"
                    min={1}
                    value={linha.quantidade}
                    onChange={(e) => atualizarQuantidade(linha.rowKey, Number(e.target.value))}
                    required
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>

                <div className="flex items-end sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removerLinha(linha.rowKey)}
                    disabled={pending || linhas.length <= 1}
                    className="text-muted-foreground"
                  >
                    Remover
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button type="submit" disabled={pending || products.length === 0}>
        {pending ? "Emitindo…" : "Emitir transferência + remessa"}
      </Button>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-success">
          Transferência …{state.chaveTransferencia?.slice(-8)} e remessa …
          {state.chaveRemessa?.slice(-8)} emitidas
          {state.totalItens && state.totalItens > 1 ? ` (${state.totalItens} produtos)` : ""}. CT-e …
          {state.chaveCte?.slice(-8)}.{" "}
          <Link href="/nfe" className="underline">
            Ver NF-e
          </Link>
        </p>
      )}
    </form>
  );
}
