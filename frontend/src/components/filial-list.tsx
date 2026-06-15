"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteFilialAction } from "@/app/(app)/empresas/actions";
import { FilialForm } from "@/components/filial-form";
import { Button } from "@/components/ui/button";
import type { UnidadeLogisticaDto } from "@/lib/fiscal-api";
import type { TenantFilialDto } from "@/lib/fiscal-types";

type Props = {
  filiais: TenantFilialDto[];
  unidades: UnidadeLogisticaDto[];
};

export function FilialList({ filiais, unidades }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function excluir(id: string) {
    if (!confirm("Excluir esta filial? Esta ação não pode ser desfeita.")) return;
    setDeletingId(id);
    const result = await deleteFilialAction(id);
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
    setDeletingId(null);
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Estabelecimento</th>
            <th className="px-4 py-2 font-medium">CNPJ</th>
            <th className="px-4 py-2 font-medium">Local</th>
            <th className="px-4 py-2 font-medium">Série remessa</th>
            <th className="px-4 py-2 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filiais.map((f) => (
            <tr key={f.id}>
              <td className="px-4 py-3">
                <div className="font-medium">{f.nomeFantasia}</div>
                <div className="text-xs text-muted-foreground">{f.razaoSocial}</div>
              </td>
              <td className="px-4 py-3 font-mono text-xs">{f.cnpj}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {f.municipio}/{f.uf}
              </td>
              <td className="px-4 py-3">{f.serieRemessa}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingId(editingId === f.id ? null : f.id)}
                  >
                    {editingId === f.id ? "Fechar" : "Editar"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={deletingId === f.id}
                    onClick={() => excluir(f.id)}
                  >
                    {deletingId === f.id ? "…" : "Excluir"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingId && (
        <div className="border-t border-border p-4 bg-muted/20">
          <FilialForm
            unidades={unidades}
            filial={filiais.find((f) => f.id === editingId)}
            onCancel={() => setEditingId(null)}
            onSaved={() => setEditingId(null)}
          />
        </div>
      )}
    </div>
  );
}
