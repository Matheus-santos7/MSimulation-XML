"use client";

import { useState } from "react";
import { FiscalSettingsCard, FiscalSettingsScreenLayout } from "@/components/fiscal-settings/screen-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FiscalEmitterSettingsData } from "@/lib/fiscal-emitter-settings-types";
import { Plus, Trash2 } from "lucide-react";

export function AcessoExternoEditor({
  initial,
}: {
  initial: FiscalEmitterSettingsData["nfe"]["contatos"];
}) {
  const [contatos, setContatos] = useState(
    initial.length > 0 ? initial : [{ nome: "", email: "" }],
  );

  function add() {
    setContatos((c) => [...c, { nome: "", email: "" }]);
  }

  function remove(i: number) {
    setContatos((c) => c.filter((_, j) => j !== i));
  }

  function update(i: number, field: "nome" | "email", value: string) {
    setContatos((c) => c.map((row, j) => (j === i ? { ...row, [field]: value } : row)));
  }

  const validos = contatos.filter((c) => c.nome.trim() && c.email.trim());

  return (
    <FiscalSettingsScreenLayout
      title="Acesso externo a NF-e"
      description="Cadastre contatos autorizados a acessar suas NF-e na Sefaz (consulta externa)."
      breadcrumb="Acesso externo a NF-e"
      onSave={() => ({
        nfe: {
          contatos: validos,
          acessoExternoContatos: validos.length,
        },
      })}
    >
      <FiscalSettingsCard className="space-y-4 p-6">
        {contatos.map((c, i) => (
          <div key={i} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`nome-${i}`}>Nome</Label>
              <Input
                id={`nome-${i}`}
                value={c.nome}
                onChange={(e) => update(i, "nome", e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`email-${i}`}>E-mail</Label>
              <Input
                id={`email-${i}`}
                type="email"
                value={c.email}
                onChange={(e) => update(i, "email", e.target.value)}
                placeholder="email@empresa.com"
              />
            </div>
            {contatos.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="sm:col-span-2 w-fit text-destructive"
                onClick={() => remove(i)}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Remover
              </Button>
            ) : null}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 h-4 w-4" />
          Adicionar contato
        </Button>
      </FiscalSettingsCard>
    </FiscalSettingsScreenLayout>
  );
}
