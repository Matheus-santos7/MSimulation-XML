"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { revalidarNfesPendentesAction } from "@/app/(app)/ia/actions";
import { Button } from "@/components/ui/button";

type Props = {
  pendingCount: number;
  validatorReachable: boolean;
};

/** Dispara backfill de validação MCP para NF-es pendentes (admin). */
export function FiscalValidationBackfillButton({ pendingCount, validatorReachable }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (pendingCount <= 0) return null;

  function handleClick() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await revalidarNfesPendentesAction();
      if (result.error) {
        setError(result.error);
        return;
      }

      if ((result.approved ?? 0) === 0 && (result.rejected ?? 0) === 0 && (result.processed ?? 0) > 0) {
        const hint = result.validatorMessage ?? result.samplePendingMessage;
        setError(
          hint
            ? `Nenhuma NF-e foi validada: ${hint}`
            : "Nenhuma NF-e foi validada. Verifique se o validador MCP está online em produção.",
        );
        return;
      }

      const parts = [
        `${result.processed ?? 0} processada(s)`,
        `${result.approved ?? 0} aprovada(s)`,
        `${result.rejected ?? 0} rejeitada(s)`,
      ];
      if ((result.skipped ?? 0) > 0) parts.push(`${result.skipped} ignorada(s)`);
      if ((result.remaining ?? 0) > 0) {
        parts.push(`${result.remaining} ainda pendente(s)`);
      }
      setMessage(parts.join(" · "));
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || !validatorReachable}
        onClick={handleClick}
        title={
          validatorReachable
            ? undefined
            : "Validador MCP indisponível — configure o serviço em produção antes de revalidar"
        }
      >
        <RefreshCw className={`size-4 mr-2 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Revalidando…" : `Revalidar ${pendingCount} pendente(s)`}
      </Button>
      {error && <p className="text-xs text-destructive max-w-sm text-right">{error}</p>}
      {message && <p className="text-xs text-success max-w-sm text-right">{message}</p>}
    </div>
  );
}
