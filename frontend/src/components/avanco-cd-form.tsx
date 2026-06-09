"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import type { AvancoCdState } from "@/app/(app)/unidades-logisticas/actions";
import {
  emitirAvancoCdAction,
  listarSaldoCdRemessaAction,
} from "@/app/(app)/unidades-logisticas/actions";
import { Button } from "@/components/ui/button";
import type { SaldoRemessaCdDto, UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { ProductDto } from "@/lib/fiscal-types";

type Props = {
  products: ProductDto[];
  unidades: UnidadeLogisticaDto[];
};

function saldoLabel(saldo: number | undefined): string {
  if (saldo == null || saldo <= 0) return "saldo: 0";
  return `saldo: ${saldo}`;
}

export function AvancoCdForm({ products, unidades }: Props) {
  const [state, submit, pending] = useActionState<AvancoCdState, FormData>(
    emitirAvancoCdAction,
    {},
  );
  const [, startTransition] = useTransition();
  const [productId, setProductId] = useState("");
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [saldos, setSaldos] = useState<SaldoRemessaCdDto[]>([]);
  const [saldoLoading, setSaldoLoading] = useState(false);

  const carregarSaldos = useCallback(async (pid: string, sku?: string) => {
    if (!pid) {
      setSaldos([]);
      return;
    }
    setSaldos([]);
    setSaldoLoading(true);
    try {
      const rows = await listarSaldoCdRemessaAction(pid, sku);
      setSaldos(rows);
    } catch {
      setSaldos([]);
    } finally {
      setSaldoLoading(false);
    }
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);

  useEffect(() => {
    void carregarSaldos(productId, selectedProduct?.sku);
  }, [productId, selectedProduct?.sku, carregarSaldos]);

  useEffect(() => {
    if (state.success) {
      void carregarSaldos(productId, selectedProduct?.sku);
    }
  }, [state.success, productId, selectedProduct?.sku, carregarSaldos]);

  const saldoPorCd = new Map(saldos.map((s) => [s.unidadeDestinoId, s.saldo]));
  const saldoOrigem = origemId ? (saldoPorCd.get(origemId) ?? 0) : 0;
  const quantidadeInvalida = origemId.length > 0 && quantidade > saldoOrigem;

  function handleSubmit() {
    const formData = new FormData();
    formData.set("avanco_productId", productId);
    if (selectedProduct?.sku) formData.set("avanco_productSku", selectedProduct.sku);
    formData.set("avanco_unidadeOrigemId", origemId);
    formData.set("avanco_unidadeDestinoId", destinoId);
    formData.set("avanco_quantidade", String(quantidade));
    startTransition(() => {
      submit(formData);
    });
  }

  if (unidades.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Cadastre pelo menos dois CDs (importação da planilha) para emitir avanço entre unidades.
      </p>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">
        Avanço de mercadoria entre CDs (cenário 3)
      </div>
      <p className="text-sm text-muted-foreground">
        Emite remessa simbólica no CD de origem (debita saldo FIFO) e nova remessa física no CD destino, com
        registro de movimentação fiscal.
      </p>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Produto</span>
        <select
          required
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setOrigemId("");
            setDestinoId("");
          }}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">Selecione…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.nome}
            </option>
          ))}
        </select>
      </label>

      {productId && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Saldo FIFO por CD
          </p>
          {saldoLoading ? (
            <p className="text-muted-foreground">Carregando saldos…</p>
          ) : saldos.length === 0 ? (
            <p className="text-muted-foreground">
              Nenhum saldo neste produto. Emita uma remessa física para o CD de origem antes do avanço.
            </p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {saldos.map((s) => (
                <li key={s.unidadeDestinoId} className="font-mono text-xs">
                  <span className="font-sans font-medium">
                    {s.unidade?.codigo ?? s.unidadeDestinoId.slice(0, 8)}
                  </span>
                  {" — "}
                  {s.unidade?.nome}/{s.unidade?.uf}:{" "}
                  <span className="text-foreground">{s.saldo}</span> un
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">CD origem (saldo)</span>
          <select
            required
            value={origemId}
            onChange={(e) => setOrigemId(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Selecione…</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.codigo} — {u.endereco.uf} / {u.endereco.municipio} (
                {saldoLabel(saldoPorCd.get(u.id))})
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">CD destino</span>
          <select
            required
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Selecione…</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id} disabled={u.id === origemId}>
                {u.codigo} — {u.endereco.uf} / {u.endereco.municipio} (
                {saldoLabel(saldoPorCd.get(u.id))})
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1 max-w-[8rem]">
        <span className="text-xs text-muted-foreground">
          Quantidade{origemId ? ` (máx. ${saldoOrigem})` : ""}
        </span>
        <input
          type="number"
          min={1}
          max={origemId ? Math.max(saldoOrigem, 1) : undefined}
          value={quantidade}
          onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
          required
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </label>

      {quantidadeInvalida && (
        <p className="text-sm text-destructive">
          Quantidade maior que o saldo disponível no CD origem ({saldoOrigem} un).
        </p>
      )}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={
          pending ||
          saldoLoading ||
          products.length === 0 ||
          !productId ||
          !origemId ||
          !destinoId ||
          quantidadeInvalida ||
          saldoOrigem <= 0
        }
      >
        {pending ? "Emitindo…" : "Emitir avanço entre CDs"}
      </Button>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-success">
          Avanço emitido. Saldo debitado no CD origem. Remessa destino: {state.chaveRemessa?.slice(-8)} ·
          Simbólica: {state.chaveSimbolica?.slice(-8)}
        </p>
      )}
    </div>
  );
}
