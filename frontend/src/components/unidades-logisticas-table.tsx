"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { definirUnidadePadraoAction } from "@/app/(app)/unidades-logisticas/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";

type Props = {
  unidades: UnidadeLogisticaDto[];
};

export function UnidadesLogisticasTable({ unidades }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const sorted = [...unidades].sort((a, b) => {
    if (a.padrao !== b.padrao) return a.padrao ? -1 : 1;
    return a.codigo.localeCompare(b.codigo);
  });

  if (unidades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nenhuma unidade encontrada para os filtros informados.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {feedback && (
        <p
          className={`text-sm ${feedback.type === "success" ? "text-success" : "text-destructive"}`}
          role="status"
        >
          {feedback.message}
        </p>
      )}

      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">CNPJ</th>
              <th className="px-3 py-2">UF</th>
              <th className="px-3 py-2">Município</th>
              <th className="px-3 py-2">CEP</th>
              <th className="px-3 py-2 w-40" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-border/60 hover:bg-muted/20 ${
                  u.padrao ? "bg-accent/5" : ""
                }`}
              >
                <td className="px-3 py-2 max-w-[280px]" title={u.nome}>
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span className="truncate">{u.nome}</span>
                    {u.padrao && (
                      <Badge variant="secondary" className="shrink-0 text-[10px] font-normal normal-case">
                        Padrão da empresa
                      </Badge>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{u.cnpj}</td>
                <td className="px-3 py-2">{u.endereco.uf}</td>
                <td className="px-3 py-2">{u.endereco.municipio}</td>
                <td className="px-3 py-2 font-mono text-xs">{u.endereco.cep}</td>
                <td className="px-3 py-2">
                  {u.padrao ? (
                    <Button type="button" variant="secondary" size="sm" disabled>
                      CD padrão
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          setFeedback(null);
                          const result = await definirUnidadePadraoAction(u.id);
                          if (result.error) {
                            setFeedback({ type: "error", message: result.error });
                            return;
                          }
                          setFeedback({
                            type: "success",
                            message: `${u.nome} definido como CD padrão de remessa da sua empresa.`,
                          });
                          router.refresh();
                        })
                      }
                    >
                      Usar como padrão
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {unidades.length} unidade(s) · o padrão é exclusivo por empresa (tenant)
        </p>
      </div>
    </div>
  );
}
