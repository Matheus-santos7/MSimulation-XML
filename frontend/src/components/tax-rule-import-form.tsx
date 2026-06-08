"use client";

import { useActionState } from "react";
import type { TaxRuleImportState } from "@/app/(app)/regras/actions";
import { importarRegrasTributariasAction } from "@/app/(app)/regras/actions";
import { TaxRuleDeleteAllButton } from "@/components/tax-rule-delete-all-button";
import { Button } from "@/components/ui/button";

type Props = {
  rulesCount: number;
};

export function TaxRuleImportForm({ rulesCount }: Props) {
  const [state, action, pending] = useActionState<TaxRuleImportState, FormData>(importarRegrasTributariasAction, {});

  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">
          Importar planilha Mercado Livre (.xlsx)
        </div>
        <TaxRuleDeleteAllButton rulesCount={rulesCount} />
      </div>

      <form action={action} className="space-y-3">
        <input
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-foreground"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Importando…" : "Importar regras"}
        </Button>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.success && (
          <p className="text-sm text-success">
            Importação concluída: {state.created} criada(s), {state.updated} atualizada(s), total {state.total}.
          </p>
        )}
        {state.parseErrors && state.parseErrors.length > 0 && (
          <p className="text-xs text-amber-500">
            {state.parseErrors.length} linha(s) ignorada(s) por inconsistência.
          </p>
        )}
      </form>
    </div>
  );
}
