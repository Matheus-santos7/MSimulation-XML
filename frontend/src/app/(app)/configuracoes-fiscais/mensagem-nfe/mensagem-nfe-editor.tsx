"use client";

import { useState } from "react";
import { FiscalSettingsCard, FiscalSettingsScreenLayout } from "@/components/fiscal-settings/screen-layout";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FiscalEmitterSettingsData } from "@/lib/fiscal-emitter-settings-types";

export function MensagemNfeEditor({
  initial,
}: {
  initial: Pick<FiscalEmitterSettingsData["nfe"], "mensagemNfeOk" | "mensagemPadrao">;
}) {
  const [ok, setOk] = useState(initial.mensagemNfeOk);
  const [mensagem, setMensagem] = useState(initial.mensagemPadrao ?? "");

  return (
    <FiscalSettingsScreenLayout
      title="Mensagem na NF-e"
      description="Configure mensagens complementares com informações obrigatórias, benefícios fiscais e isenções no XML da NF-e."
      breadcrumb="Mensagem na NF-e"
      onSave={() => ({
        nfe: {
          mensagemNfeOk: ok,
          mensagemPadrao: mensagem.trim(),
        },
      })}
    >
      <FiscalSettingsCard className="space-y-4 p-6">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={ok} onCheckedChange={(c) => setOk(c === true)} />
          Mensagens configuradas e prontas para emissão
        </label>
        <div className="space-y-2">
          <Label htmlFor="msg">Texto padrão (infAdFisco / infCpl)</Label>
          <Textarea
            id="msg"
            rows={6}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Ex.: Documento emitido por ME optante pelo Simples Nacional…"
          />
        </div>
      </FiscalSettingsCard>
    </FiscalSettingsScreenLayout>
  );
}
