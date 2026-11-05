"use client";

import { useActionState } from "react";
import type { TaxRuleImportState } from "@/app/(app)/regras/actions";
import { importarRegrasTributariasAction } from "@/app/(app)/regras/actions";
import { DeleteTaxAllButton } from "@/components/delete-tax-all-button";
import { Button } from "@/components/ui/button";
import { toUserFacingError } from "@/lib/user-facing-error";

/** Quantas mensagens de linha ignorada aparecem na tela antes do "…e mais N". */
const MAX_VISIBLE_PARSE_ERRORS = 10;

type Props = {
  rulesCount: number;
  isAdmin?: boolean;
};

export function TaxRuleImportForm({ rulesCount, isAdmin = false }: Props) {
  const [state, action, pending] = useActionState<TaxRuleImportState, FormData>(importarRegrasTributariasAction, {});

  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[12px] uppercase font-bold tracking-widest text-muted-foreground">
          Importar planilha Mercado Livre (.xlsx)
        </div>
        {isAdmin ? <DeleteTaxAllButton rulesCount={rulesCount} /> : null}
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

        {state.error && <p className="text-sm text-destructive">{toUserFacingError(state.error)}</p>}
        {state.success && (
          <p className="text-sm text-success">
            Importação concluída: {state.created} criada(s), {state.updated} atualizada(s), total {state.total}.
          </p>
        )}
        {state.parseErrors && state.parseErrors.length > 0 && (
          <div className="text-xs text-amber-500 space-y-1">
            <p>{state.parseErrors.length} linha(s) ignorada(s) por inconsistência.</p>
            {/* Mostra o motivo de cada linha (ex.: "Regra duplicada"): só a contagem não diz ao
                usuário o que corrigir na planilha. O teto evita inundar a tela em planilhas ruins;
                para ver todas, aumente MAX_VISIBLE_PARSE_ERRORS. */}
            <ul className="list-disc pl-4">
              {state.parseErrors.slice(0, MAX_VISIBLE_PARSE_ERRORS).map((parseError) => (
                <li key={`${parseError.line}-${parseError.message}`}>
                  Linha {parseError.line}: {parseError.message}
                </li>
              ))}
            </ul>
            {state.parseErrors.length > MAX_VISIBLE_PARSE_ERRORS && (
              <p>…e mais {state.parseErrors.length - MAX_VISIBLE_PARSE_ERRORS} linha(s).</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
