"use client";

import { useState } from "react";
import { FilialForm } from "@/components/filial-form";
import { Button } from "@/components/ui/button";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { TenantFilialDto } from "@/lib/fiscal-types";

type Props = {
  filiais: TenantFilialDto[];
  unidades: UnidadeLogisticaDto[];
};

export function FilialList({ filiais, unidades }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (filiais.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Filiais cadastradas</h2>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {filiais.map((f) => (
          <li key={f.id} className="px-4 py-3 text-sm space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium">{f.nomeFantasia}</div>
                <div className="text-muted-foreground">
                  {f.cnpj} · {f.municipio}/{f.uf} · série remessa {f.serieRemessa}
                  {f.emitenteFiscalPrincipal ? " · emitente principal" : ""}
                  {f.emitenteFiscalMatriz ? " · emitente matriz" : ""}
                </div>
              </div>
              {editingId !== f.id && (
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(f.id)}>
                  Editar
                </Button>
              )}
            </div>
            {editingId === f.id && (
              <FilialForm
                unidades={unidades}
                filial={f}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
