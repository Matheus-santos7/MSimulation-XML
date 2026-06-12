"use client";

import { useActionState } from "react";
import {
  importarUnidadesLogisticasAction,
  type UnidadesLogisticasImportState,
} from "@/app/(app)/unidades-logisticas/actions";
import { Button } from "@/components/ui/button";

export function UnidadesLogisticasImportForm() {
  const [state, action, pending] = useActionState<UnidadesLogisticasImportState, FormData>(
    importarUnidadesLogisticasAction,
    {},
  );

  const warnings = [...(state.parseErrors ?? []), ...(state.errors ?? [])];

  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">
        Importar planilha Mercado Livre Full (.xlsx)
      </div>
      <p className="text-sm text-muted-foreground">
        O arquivo é enviado integralmente ao backend. Colunas esperadas: Unidade, CNPJ, endereço e ID
        intermediador.
      </p>

      <form action={action} className="space-y-3">
        <input
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-foreground"
        />

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="hidden" name="enrichCep" value="false" />
          <input
            type="checkbox"
            name="enrichCep"
            value="true"
            defaultChecked
            className="size-4 rounded border border-border"
          />
          Enriquecer CEP via ViaCEP (recomendado)
        </label>

        <Button type="submit" disabled={pending}>
          {pending ? "Importando…" : "Importar unidades"}
        </Button>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.success && (
          <p className="text-sm text-success">
            Importação concluída: {state.created ?? 0} criada(s), {state.updated ?? 0} atualizada(s),{" "}
            {state.skipped ?? 0} ignorada(s) — {state.unicos ?? 0} única(s) de {state.totalPlanilha ?? 0}{" "}
            linha(s) na planilha.
          </p>
        )}
        {warnings.length > 0 && (
          <ul className="text-xs text-amber-600 max-h-24 overflow-y-auto font-mono space-y-0.5">
            {warnings.slice(0, 10).map((w) => (
              <li key={`${w.line}-${w.message}`}>
                Linha {w.line}: {w.message}
              </li>
            ))}
            {warnings.length > 10 && <li>… e mais {warnings.length - 10} aviso(s)</li>}
          </ul>
        )}
      </form>
    </div>
  );
}
